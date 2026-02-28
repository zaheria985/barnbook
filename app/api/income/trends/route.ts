import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIncomeTrends } from "@/lib/queries/income";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trends = await getIncomeTrends();
    return NextResponse.json(trends);
  } catch (error) {
    console.error("Failed to fetch income trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch income trends" },
      { status: 500 }
    );
  }
}
