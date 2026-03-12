import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  updateIncomeCategory,
  deleteIncomeCategory,
} from "@/lib/queries/income";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { name?: string; sort_order?: number } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      data.name = body.name.trim();
    }
    if (body.sort_order !== undefined) {
      data.sort_order = Number(body.sort_order);
    }

    const category = await updateIncomeCategory(id, data);
    if (!category) {
      return NextResponse.json(
        { error: "Income category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update income category:", error);
    return NextResponse.json(
      { error: "Failed to update income category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteIncomeCategory(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Income category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete income category";
    const status = message.includes("Cannot delete") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
