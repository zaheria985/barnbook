import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSavingsBalance } from "@/lib/queries/budget-overview";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const balance = await getSavingsBalance();
    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Failed to fetch savings balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch savings balance" },
      { status: 500 }
    );
  }
}
