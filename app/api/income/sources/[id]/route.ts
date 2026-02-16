import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  updateIncomeSource,
  deleteIncomeSource,
} from "@/lib/queries/income";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    const source = await updateIncomeSource(params.id, data);
    if (!source) {
      return NextResponse.json(
        { error: "Income source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error("Failed to update income source:", error);
    return NextResponse.json(
      { error: "Failed to update income source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteIncomeSource(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Income source not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete income source";
    const status = message.includes("Cannot delete") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
