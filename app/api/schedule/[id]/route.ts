import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateSlot, deleteSlot } from "@/lib/queries/ride-schedule";

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
    const slot = await updateSlot(params.id, {
      day_of_week: body.day_of_week !== undefined ? Number(body.day_of_week) : undefined,
      start_time: body.start_time,
      end_time: body.end_time,
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    return NextResponse.json(slot);
  } catch (error) {
    console.error("Failed to update slot:", error);
    return NextResponse.json({ error: "Failed to update slot" }, { status: 500 });
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
    const deleted = await deleteSlot(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete slot:", error);
    return NextResponse.json({ error: "Failed to delete slot" }, { status: 500 });
  }
}
