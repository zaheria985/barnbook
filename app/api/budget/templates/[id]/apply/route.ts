import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyTemplateToMonth } from "@/lib/queries/budget-templates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { month, mode } = await request.json();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
    }
    if (!mode || !["fill", "overwrite"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'fill' or 'overwrite'" }, { status: 400 });
    }

    const count = await applyTemplateToMonth(id, month, mode);
    return NextResponse.json({ applied: count });
  } catch (error) {
    console.error("Failed to apply template:", error);
    return NextResponse.json({ error: "Failed to apply template" }, { status: 500 });
  }
}
