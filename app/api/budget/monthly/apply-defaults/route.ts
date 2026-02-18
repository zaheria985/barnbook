import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyDefaultsToMonth } from "@/lib/queries/monthly-budgets";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { month, mode } = await request.json();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month required (YYYY-MM)" },
        { status: 400 }
      );
    }

    if (mode !== "fill" && mode !== "overwrite") {
      return NextResponse.json(
        { error: 'mode must be "fill" or "overwrite"' },
        { status: 400 }
      );
    }

    const count = await applyDefaultsToMonth(month, mode);
    return NextResponse.json({ applied: count });
  } catch (error) {
    console.error("Failed to apply defaults:", error);
    return NextResponse.json(
      { error: "Failed to apply defaults" },
      { status: 500 }
    );
  }
}
