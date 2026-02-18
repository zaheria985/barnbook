import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVendorSpending } from "@/lib/queries/expenses";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month") || undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM format" },
      { status: 400 }
    );
  }

  try {
    const spending = await getVendorSpending(month);
    return NextResponse.json(spending);
  } catch (error) {
    console.error("Failed to get vendor spending:", error);
    return NextResponse.json(
      { error: "Failed to get vendor spending" },
      { status: 500 }
    );
  }
}
