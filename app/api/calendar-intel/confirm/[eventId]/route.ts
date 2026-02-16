import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateEvent } from "@/lib/queries/events";

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Confirm means marking as confirmed and updating event_type if provided
    const event = await updateEvent(params.eventId, {
      event_type: body.event_type || undefined,
      notes: body.notes || undefined,
      is_confirmed: true,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Failed to confirm event:", error);
    return NextResponse.json({ error: "Failed to confirm event" }, { status: 500 });
  }
}
