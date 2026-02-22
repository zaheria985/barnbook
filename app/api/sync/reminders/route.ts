import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as caldav from "@/lib/caldav";
import { getEvent, updateEvent } from "@/lib/queries/events";
import { getChecklist } from "@/lib/queries/event-checklists";
import { getIcloudSettings } from "@/lib/queries/icloud-sync";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!caldav.isConfigured()) {
    return NextResponse.json(
      { error: "iCloud not configured", configured: false },
      { status: 503 }
    );
  }

  const icloudSettings = await getIcloudSettings();
  if (!icloudSettings?.write_reminders_calendar_id) {
    return NextResponse.json(
      { error: "No Reminders list configured. Select one in Settings > Integrations.", configured: false },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { event_id } = body;

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    }

    const event = await getEvent(event_id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const calendarId = icloudSettings.write_reminders_calendar_id;

    // Create main reminder for the event
    const mainUid = await caldav.writeReminder(calendarId, {
      title: event.title,
      due: event.start_date,
      description: `${event.event_type} | ${event.location || "No location"}`,
    });

    // Store UID on event
    await updateEvent(event_id, { reminder_uid: mainUid });

    // Sync checklist items as individual reminders
    const checklist = await getChecklist(event_id);
    for (const item of checklist) {
      const itemUid = await caldav.writeReminder(calendarId, {
        title: item.title,
        due: item.due_date,
      });

      await pool.query(
        `UPDATE event_checklists SET reminder_uid = $1 WHERE id = $2`,
        [itemUid, item.id]
      );
    }

    return NextResponse.json({
      success: true,
      reminder_uid: mainUid,
      synced_items: checklist.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to sync reminders:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
