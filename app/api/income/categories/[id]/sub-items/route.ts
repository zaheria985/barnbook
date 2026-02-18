import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createIncomeSubItem } from "@/lib/queries/income";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { label } = await request.json();
    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json(
        { error: "Sub-item label is required" },
        { status: 400 }
      );
    }

    const subItem = await createIncomeSubItem(params.id, label.trim());
    return NextResponse.json(subItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create income sub-item:", error);
    return NextResponse.json(
      { error: "Failed to create income sub-item" },
      { status: 500 }
    );
  }
}
