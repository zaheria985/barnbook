import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCategorySpendingTrends } from "@/lib/queries/expense-trends";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trends = await getCategorySpendingTrends();
    return NextResponse.json(trends);
  } catch (error) {
    console.error("Failed to fetch spending trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch spending trends" },
      { status: 500 }
    );
  }
}
