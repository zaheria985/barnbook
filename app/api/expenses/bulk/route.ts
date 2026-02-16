import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createExpense } from "@/lib/queries/expenses";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";

interface BulkExpenseItem {
  category_id: string;
  sub_item_id?: string | null;
  amount: number;
  vendor?: string | null;
  date: string;
  notes?: string | null;
}

interface BulkResult {
  success: boolean;
  error?: string;
  expense?: unknown;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { expenses }: { expenses: BulkExpenseItem[] } = await request.json();

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return NextResponse.json(
        { error: "expenses array is required" },
        { status: 400 }
      );
    }

    const userId = (session.user as { id?: string }).id || null;
    const results: BulkResult[] = [];

    const monthsToCheck = new Set(expenses.map((e) => e.date.substring(0, 7)));
    for (const month of monthsToCheck) {
      const closed = await isMonthClosed(month);
      if (closed) {
        return NextResponse.json(
          { error: `Cannot add expenses to closed month: ${month}` },
          { status: 403 }
        );
      }
    }

    for (const item of expenses) {
      try {
        if (!item.category_id || item.amount === undefined || !item.date) {
          results.push({
            success: false,
            error: "Missing required fields: category_id, amount, or date",
          });
          continue;
        }

        const expense = await createExpense({
          category_id: item.category_id,
          sub_item_id: item.sub_item_id || null,
          amount: Number(item.amount),
          vendor: item.vendor || null,
          date: item.date,
          notes: item.notes || null,
          created_by: userId,
        });

        results.push({ success: true, expense });
      } catch (err) {
        results.push({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to bulk create expenses:", error);
    return NextResponse.json(
      { error: "Failed to create expenses" },
      { status: 500 }
    );
  }
}
