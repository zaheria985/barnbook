import { NextRequest, NextResponse } from "next/server";
import { parseVenmoReceipt, parseGenericReceipt, isPlausibleAmount } from "@/lib/email-parser";
import { matchVendor } from "@/lib/queries/vendor-mappings";
import { recordFailedIngest } from "@/lib/queries/failed-ingests";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secret = process.env.EMAIL_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Email ingestion not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: { html?: string; text?: string; subject?: string } = {};
  try {
    body = await request.json();
    const { html, text, subject } = body;

    // Try parsing as Venmo receipt first
    let parsed = html ? parseVenmoReceipt(html) : null;
    if (!parsed && text) {
      parsed = parseGenericReceipt(text);
    }

    if (!parsed) {
      await recordFailedIngest({
        subject: subject ?? null,
        reason: "Could not parse receipt from email",
        raw_payload: body,
      });
      return NextResponse.json(
        { error: "Could not parse receipt from email", subject },
        { status: 422 }
      );
    }

    // Guard against mis-parsed amounts becoming bogus expenses.
    if (!isPlausibleAmount(parsed.amount)) {
      await recordFailedIngest({
        subject: subject ?? null,
        reason: `Implausible amount parsed: ${parsed.amount}`,
        raw_payload: body,
      });
      return NextResponse.json(
        { error: "Parsed amount looks implausible; sent to review", parsed },
        { status: 422 }
      );
    }

    // Try auto-matching vendor
    const vendorMatch = await matchVendor(parsed.recipient);

    // If the receipt's month is already closed, force it to pending (null
    // category) so it doesn't alter the frozen closed-month totals; it stays
    // reviewable on the pending page.
    const yearMonth = parsed.date.slice(0, 7);
    const closed = await isMonthClosed(yearMonth);
    const categoryId = closed ? null : vendorMatch?.category_id || null;
    const subItemId = closed ? null : vendorMatch?.sub_item_id || null;

    // Create pending expense (source=email, uncategorized if no vendor match)
    const res = await pool.query(
      `INSERT INTO expenses (category_id, sub_item_id, amount, vendor, date, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        categoryId,
        subItemId,
        parsed.amount,
        parsed.recipient,
        parsed.date,
        parsed.note,
        parsed.source,
      ]
    );

    return NextResponse.json({
      success: true,
      expense_id: res.rows[0].id,
      auto_categorized: !!categoryId,
      deferred_closed_month: closed,
      category: closed ? null : vendorMatch?.category_name || null,
      parsed,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to ingest email:", error);
    await recordFailedIngest({
      subject: body?.subject ?? null,
      reason: `Ingest error: ${error instanceof Error ? error.message : String(error)}`,
      raw_payload: body,
    }).catch(() => {});
    return NextResponse.json({ error: "Failed to ingest email" }, { status: 500 });
  }
}
