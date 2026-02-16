import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateExpense, deleteExpense } from "@/lib/queries/expenses";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";
import pool from "@/lib/db";

async function getExpenseMonth(id: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT TO_CHAR(date, 'YYYY-MM') AS year_month FROM expenses WHERE id = $1`,
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
    const yearMonth = await getExpenseMonth(params.id);
    if (!yearMonth) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot edit expenses in a closed month" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const expense = await updateExpense(params.id, body);
    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
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
    const yearMonth = await getExpenseMonth(params.id);
    if (!yearMonth) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot delete expenses in a closed month" },
        { status: 403 }
      );
    }

    const deleted = await deleteExpense(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
