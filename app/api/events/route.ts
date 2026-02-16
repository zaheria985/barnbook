import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEvents, createEvent } from "@/lib/queries/events";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const from = request.nextUrl.searchParams.get("from") || undefined;
    const to = request.nextUrl.searchParams.get("to") || undefined;
    const events = await getEvents(from, to);
    return NextResponse.json(events);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.event_type?.trim()) {
      return NextResponse.json({ error: "event_type is required" }, { status: 400 });
    }
    if (!body.start_date) {
      return NextResponse.json({ error: "start_date is required" }, { status: 400 });
    }

    const event = await createEvent({
      title: body.title.trim(),
      event_type: body.event_type.trim(),
      start_date: body.start_date,
      end_date: body.end_date || null,
      location: body.location?.trim() || null,
      entry_due_date: body.entry_due_date || null,
      notes: body.notes?.trim() || null,
      checklist_template_id: body.checklist_template_id || null,
      created_by: (session.user as { id: string }).id,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
