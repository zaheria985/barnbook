import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateIncomeSubItem, deleteIncomeSubItem } from "@/lib/queries/income";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data: { label?: string; sort_order?: number } = {};

    if (body.label !== undefined) {
      if (typeof body.label !== "string" || !body.label.trim()) {
        return NextResponse.json(
          { error: "Label must be a non-empty string" },
          { status: 400 }
        );
      }
      data.label = body.label.trim();
    }
    if (body.sort_order !== undefined) {
      data.sort_order = Number(body.sort_order);
    }

    const subItem = await updateIncomeSubItem(params.subId, data);
    if (!subItem) {
      return NextResponse.json(
        { error: "Sub-item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subItem);
  } catch (error) {
    console.error("Failed to update income sub-item:", error);
    return NextResponse.json(
      { error: "Failed to update income sub-item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; subId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteIncomeSubItem(params.subId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Sub-item not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete sub-item";
    const status = message.includes("Cannot delete") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
