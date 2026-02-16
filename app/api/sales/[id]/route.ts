import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateSale, deleteSale } from "@/lib/queries/sales";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";
import pool from "@/lib/db";

async function getSaleMonth(id: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT TO_CHAR(date, 'YYYY-MM') AS year_month FROM sales WHERE id = $1`,
    [id]
  );
  return res.rows[0]?.year_month || null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const yearMonth = await getSaleMonth(params.id);
    if (!yearMonth) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot edit sales in a closed month" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const sale = await updateSale(params.id, body);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Failed to update sale:", error);
    return NextResponse.json(
      { error: "Failed to update sale" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const yearMonth = await getSaleMonth(params.id);
    if (!yearMonth) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot delete sales in a closed month" },
        { status: 403 }
      );
    }

    const deleted = await deleteSale(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete sale:", error);
    return NextResponse.json(
      { error: "Failed to delete sale" },
      { status: 500 }
    );
  }
}
