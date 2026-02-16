import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setMonthlyIncome } from "@/lib/queries/income";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { yearMonth, sourceId, projected, actual } = await request.json();

    if (!yearMonth || !sourceId || projected === undefined || actual === undefined) {
      return NextResponse.json(
        { error: "yearMonth, sourceId, projected, and actual are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json(
        { error: "yearMonth must be YYYY-MM format" },
        { status: 400 }
      );
    }

    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot edit income in a closed month" },
        { status: 403 }
      );
    }

    const income = await setMonthlyIncome(
      yearMonth,
      sourceId,
      Number(projected),
      Number(actual)
    );
    return NextResponse.json(income);
  } catch (error) {
    console.error("Failed to set monthly income:", error);
    return NextResponse.json(
      { error: "Failed to set monthly income" },
      { status: 500 }
    );
  }
}
