import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBudgetDefaults,
  setBudgetDefault,
} from "@/lib/queries/budget-defaults";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const defaults = await getBudgetDefaults();
    return NextResponse.json(defaults);
  } catch (error) {
    console.error("Failed to fetch budget defaults:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget defaults" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { categoryId, subItemId, amount } = await request.json();

    if (!categoryId || amount === undefined) {
      return NextResponse.json(
        { error: "categoryId and amount are required" },
        { status: 400 }
      );
    }

    const result = await setBudgetDefault(
      categoryId,
      subItemId || null,
      Number(amount)
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to set budget default:", error);
    return NextResponse.json(
      { error: "Failed to set budget default" },
      { status: 500 }
    );
  }
}
