import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSuggestedWindows } from "@/lib/queries/icloud-sync";

/**
 * Suggested ride windows for a date range — a pure DB read (the windows are
 * precomputed by the 2-hourly sync), light enough for the home dashboard.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (
    !from ||
    !to ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return NextResponse.json(
      { error: "from and to are required as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const windows = await getSuggestedWindows(from, to);
    return NextResponse.json(windows);
  } catch (error) {
    console.error("Failed to fetch ride windows:", error);
    return NextResponse.json(
      { error: "Failed to fetch ride windows" },
      { status: 500 }
    );
  }
}
