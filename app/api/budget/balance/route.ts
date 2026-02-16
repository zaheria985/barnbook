import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  calculateMonthEndBalance,
  getMonthlyBalance,
  getSavingsBalance,
} from "@/lib/queries/monthly-balance";

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
    const [existingBalance, calculation, savingsBalance] = await Promise.all([
      getMonthlyBalance(month),
      calculateMonthEndBalance(month),
      getSavingsBalance(),
    ]);

    if (existingBalance) {
      return NextResponse.json({
        ...existingBalance,
        savings_balance: savingsBalance,
        is_live: false,
      });
    }

    return NextResponse.json({
      ...calculation,
      savings_balance: savingsBalance,
      is_closed: false,
      is_live: true,
    });
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
