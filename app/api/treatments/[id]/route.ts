import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSchedule,
  updateSchedule,
  deleteSchedule,
} from "@/lib/queries/treatment-schedules";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const schedule = await getSchedule(id);

    if (!schedule) {
      return NextResponse.json(
        { error: "Treatment schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Failed to fetch treatment schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch treatment schedule" },
      { status: 500 }
    );
  }
}

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

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name?.trim();
    if (body.horse_id !== undefined) data.horse_id = body.horse_id;
    if (body.frequency_days !== undefined) {
      const freq = Number(body.frequency_days);
      if (!Number.isFinite(freq) || freq <= 0) {
        return NextResponse.json(
          { error: "frequency_days must be a positive number" },
          { status: 400 }
        );
      }
      data.frequency_days = freq;
    }
    if (body.start_date !== undefined) data.start_date = body.start_date;
    if (body.end_date !== undefined) data.end_date = body.end_date;
    if (body.occurrence_count !== undefined) data.occurrence_count = body.occurrence_count;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.is_active !== undefined) data.is_active = body.is_active;

    const schedule = await updateSchedule(id, data);

    if (!schedule) {
      return NextResponse.json(
        { error: "Treatment schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Failed to update treatment schedule:", error);
    return NextResponse.json(
      { error: "Failed to update treatment schedule" },
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
    const deleted = await deleteSchedule(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Treatment schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete treatment schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete treatment schedule" },
      { status: 500 }
    );
  }
}
