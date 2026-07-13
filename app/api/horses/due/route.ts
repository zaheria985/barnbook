import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDueItems } from "@/lib/queries/due-items";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const withinParam = request.nextUrl.searchParams.get("within");
    const within = withinParam ? parseInt(withinParam, 10) : 30;
    const items = await getDueItems(Number.isFinite(within) ? within : 30);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch due items:", error);
    return NextResponse.json({ error: "Failed to fetch due items" }, { status: 500 });
  }
}
