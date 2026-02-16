import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getYearlySummary, getAvailableYears } from "@/lib/queries/yearly-summary";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yearParam = request.nextUrl.searchParams.get("year");

  try {
    if (!yearParam) {
      const years = await getAvailableYears();
      return NextResponse.json({ years });
    }

    const year = parseInt(yearParam, 10);
    if (!year || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const summary = await getYearlySummary(year);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch yearly summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch yearly summary" },
      { status: 500 }
    );
  }
}
