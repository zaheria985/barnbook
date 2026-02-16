import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await pool.query(
      `SELECT e.id, e.amount, e.vendor, e.date, e.notes, e.source,
              e.category_id, bc.name AS category_name
       FROM expenses e
       LEFT JOIN budget_categories bc ON bc.id = e.category_id
       WHERE e.source IN ('email', 'venmo_email')
         AND e.category_id IS NULL
       ORDER BY e.date DESC`
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error("Failed to fetch pending expenses:", error);
    return NextResponse.json({ error: "Failed to fetch pending expenses" }, { status: 500 });
  }
}
