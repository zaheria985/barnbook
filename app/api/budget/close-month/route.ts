import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { closeMonth } from "@/lib/queries/monthly-balance";
import { localYearMonth } from "@/lib/dates";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { month } = await request.json();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    // Don't allow closing a month that hasn't happened yet — closing snapshots
    // totals and adjusts savings, which makes no sense for a future month.
    if (month > localYearMonth()) {
      return NextResponse.json(
        { error: "Cannot close a future month." },
        { status: 400 }
      );
    }

    const result = await closeMonth(month);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to close month";
    const status = message.includes("already closed") ? 409 : 500;
    console.error("Failed to close month:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
