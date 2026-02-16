import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAvailableWindows } from "@/lib/queries/ride-schedule";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to query params are required" },
        { status: 400 }
      );
    }

    const windows = await getAvailableWindows(from, to);
    return NextResponse.json(windows);
  } catch (error) {
    console.error("Failed to fetch available windows:", error);
    return NextResponse.json({ error: "Failed to fetch available windows" }, { status: 500 });
  }
}
