import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.category_id) {
      return NextResponse.json(
        { error: "category_id is required" },
        { status: 400 }
      );
    }

    // Only pending email receipts (uncategorized, email-sourced) may be
    // approved here — never a normal, already-categorized expense.
    const res = await pool.query(
      `UPDATE expenses
       SET category_id = $1, sub_item_id = $2, updated_at = now()
       WHERE id = $3
         AND source IN ('email', 'venmo_email')
         AND category_id IS NULL
       RETURNING id, amount, vendor, date, category_id`,
      [body.category_id, body.sub_item_id || null, id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "No pending email expense with that id" },
        { status: 404 }
      );
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error("Failed to approve expense:", error);
    return NextResponse.json({ error: "Failed to approve expense" }, { status: 500 });
  }
}
