import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getMonthlyBudgets,
  setMonthlyBudget,
  copyBudgetsFromPreviousMonth,
} from "@/lib/queries/monthly-budgets";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  try {
    let budgets = await getMonthlyBudgets(month);

    if (budgets.length === 0) {
      const copied = await copyBudgetsFromPreviousMonth(month);
      if (copied > 0) {
        budgets = await getMonthlyBudgets(month);
      }
    }

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Failed to fetch monthly budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly budgets" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { yearMonth, categoryId, subItemId, amount } = await request.json();

    if (!yearMonth || !categoryId || amount === undefined) {
      return NextResponse.json(
        { error: "yearMonth, categoryId, and amount are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json(
        { error: "yearMonth must be YYYY-MM format" },
        { status: 400 }
      );
    }

    const budget = await setMonthlyBudget(
      yearMonth,
      categoryId,
      subItemId || null,
      Number(amount)
    );
    return NextResponse.json(budget);
  } catch (error) {
    console.error("Failed to set monthly budget:", error);
    return NextResponse.json(
      { error: "Failed to set monthly budget" },
      { status: 500 }
    );
  }
}
