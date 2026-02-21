import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSuggestedWindow,
  deleteSuggestedWindow,
  getIcloudSettings,
} from "@/lib/queries/icloud-sync";
import { createEvent } from "@/lib/queries/events";
import { writeEvent, deleteEvent } from "@/lib/caldav";

// Approve: create a Barnbook event, write to iCloud if configured, delete the window row
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ windowId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { windowId } = await params;
    const window = await getSuggestedWindow(windowId);
    if (!window) {
      return NextResponse.json({ error: "Window not found" }, { status: 404 });
    }

    // Create a confirmed Barnbook event with times
    await createEvent({
      title: "Ride Window",
      event_type: "ride",
      start_date: window.date,
      start_time: window.start_time,
      end_time: window.end_time,
      notes: window.weather_notes.length > 0
        ? window.weather_notes.join("; ")
        : null,
      is_confirmed: true,
    });

    // Write to iCloud write calendar if configured
    const settings = await getIcloudSettings();
    if (settings?.write_calendar_id) {
      const start = new Date(`${window.date}T${window.start_time}`);
      const end = new Date(`${window.date}T${window.end_time}`);

      try {
        await writeEvent(settings.write_calendar_id, {
          title: "Ride Window",
          start,
          end,
          description: window.weather_notes.length > 0
            ? window.weather_notes.join(", ")
            : undefined,
        });
      } catch (err) {
        console.error("Failed to write to iCloud, event still created locally:", err);
      }
    }

    await deleteSuggestedWindow(windowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to approve ride window:", error);
    return NextResponse.json(
      { error: "Failed to approve ride window" },
      { status: 500 }
    );
  }
}

// Dismiss: delete from iCloud if it has an ical_uid, then delete the window row
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ windowId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { windowId } = await params;
    const window = await getSuggestedWindow(windowId);
    if (!window) {
      return NextResponse.json({ error: "Window not found" }, { status: 404 });
    }

    // If the window was already written to iCloud, delete it there too
    if (window.ical_uid) {
      const settings = await getIcloudSettings();
      if (settings?.write_calendar_id) {
        try {
          await deleteEvent(settings.write_calendar_id, window.ical_uid);
        } catch (err) {
          console.error("Failed to delete iCloud event, continuing:", err);
        }
      }
    }

    await deleteSuggestedWindow(windowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss ride window:", error);
    return NextResponse.json(
      { error: "Failed to dismiss ride window" },
      { status: 500 }
    );
  }
}
