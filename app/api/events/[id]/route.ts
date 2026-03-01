import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEvent, updateEvent, deleteEvent, deleteFutureInstances, updateFutureInstances } from "@/lib/queries/events";

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
    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
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
    const updateFuture = request.nextUrl.searchParams.get("updateFuture") === "true";

    const event = await updateEvent(id, {
      title: body.title?.trim(),
      event_type: body.event_type?.trim(),
      start_date: body.start_date,
      end_date: body.end_date,
      location: body.location !== undefined ? (body.location?.trim() || null) : undefined,
      entry_due_date: body.entry_due_date,
      notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined,
      checklist_template_id: body.checklist_template_id,
      reminder_uid: body.reminder_uid,
      recurrence_rule: body.recurrence_rule,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // If this is a parent event and updateFuture is requested, propagate changes to future instances
    if (updateFuture && event.recurrence_rule) {
      const propagateData: Record<string, unknown> = {};
      if (body.title !== undefined) propagateData.title = body.title?.trim();
      if (body.event_type !== undefined) propagateData.event_type = body.event_type?.trim();
      if (body.location !== undefined) propagateData.location = body.location?.trim() || null;
      if (body.notes !== undefined) propagateData.notes = body.notes?.trim() || null;
      if (Object.keys(propagateData).length > 0) {
        await updateFutureInstances(id, propagateData);
      }
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
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

    // Check if this is a parent recurring event — also delete future instances
    const event = await getEvent(id);
    if (event?.recurrence_rule) {
      await deleteFutureInstances(id);
    }

    const deleted = await deleteEvent(id);
    if (!deleted) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
