import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccuracyStats } from "@/lib/queries/footing-feedback";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getAccuracyStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch accuracy stats:", error);
    return NextResponse.json({ error: "Failed to fetch accuracy stats" }, { status: 500 });
  }
}
