import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBudgetOverview,
  getSavingsBalance,
} from "@/lib/queries/budget-overview";
import { getMonthlyIncome } from "@/lib/queries/income";
import { hasDefaults } from "@/lib/queries/monthly-budgets";

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
    const [overview, savings, incomeRows, hasDefaultBudgets] = await Promise.all([
      getBudgetOverview(month),
      getSavingsBalance(),
      getMonthlyIncome(month),
      hasDefaults(),
    ]);

    const total_income_projected = incomeRows.reduce(
      (sum, r) => sum + Number(r.projected_amount),
      0
    );
    const total_income_actual = incomeRows.reduce(
      (sum, r) => sum + Number(r.actual_amount),
      0
    );

    return NextResponse.json({
      ...overview,
      savings_balance: savings,
      has_defaults: hasDefaultBudgets,
      total_income_projected,
      total_income_actual,
    });
  } catch (error) {
    console.error("Failed to fetch budget overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget overview" },
      { status: 500 }
    );
  }
}
