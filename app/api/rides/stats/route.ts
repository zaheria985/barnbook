import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRideStats } from "@/lib/queries/rides";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const period =
      (request.nextUrl.searchParams.get("period") as "week" | "month") ||
      "month";
    const date = request.nextUrl.searchParams.get("date") || undefined;
    const userId = (session.user as { id?: string }).id || undefined;

    const stats = await getRideStats({ period, date, rider_id: userId });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch ride stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch ride stats" },
      { status: 500 }
    );
  }
}
