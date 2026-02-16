import { NextRequest, NextResponse } from "next/server";
import { parseVenmoReceipt, parseGenericReceipt } from "@/lib/email-parser";
import { matchVendor } from "@/lib/queries/vendor-mappings";
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

  try {
    const body = await request.json();
    const { html, text, subject } = body;

    // Try parsing as Venmo receipt first
    let parsed = html ? parseVenmoReceipt(html) : null;
    if (!parsed && text) {
      parsed = parseGenericReceipt(text);
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse receipt from email", subject },
        { status: 422 }
      );
    }

    // Try auto-matching vendor
    const vendorMatch = await matchVendor(parsed.recipient);

    // Create pending expense (source=email, uncategorized if no vendor match)
    const res = await pool.query(
      `INSERT INTO expenses (category_id, sub_item_id, amount, vendor, date, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        vendorMatch?.category_id || null,
        vendorMatch?.sub_item_id || null,
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
      auto_categorized: !!vendorMatch,
      category: vendorMatch?.category_name || null,
      parsed,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to ingest email:", error);
    return NextResponse.json({ error: "Failed to ingest email" }, { status: 500 });
  }
}
