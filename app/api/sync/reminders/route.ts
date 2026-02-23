import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as caldav from "@/lib/caldav";
import * as radicale from "@/lib/radicale";
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
  if (!icloudSettings?.reminders_checklists_id && !(icloudSettings?.use_radicale && icloudSettings?.radicale_checklists_collection)) {
    return NextResponse.json(
      { error: "No Event checklists list configured. Select one in Settings > Integrations.", configured: false },
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

    // Helper: write reminder to Radicale or iCloud based on settings
    const writeReminderFn = async (
      reminder: { title: string; due?: string | Date | null; description?: string }
    ): Promise<string> => {
      if (icloudSettings!.use_radicale) {
        const collectionUrl = icloudSettings!.radicale_checklists_collection;
        if (!collectionUrl) throw new Error("No Radicale checklists collection configured");
        return radicale.writeReminder(collectionUrl, reminder);
      }
      const calendarId = icloudSettings!.reminders_checklists_id;
      if (!calendarId) throw new Error("No checklists list configured");
      return caldav.writeReminder(calendarId, reminder);
    };

    // Create main reminder for the event
    const mainUid = await writeReminderFn({
      title: event.title,
      due: event.start_date,
      description: `${event.event_type} | ${event.location || "No location"}`,
    });

    // Store UID on event
    await updateEvent(event_id, { reminder_uid: mainUid });

    // Sync checklist items as individual reminders
    const checklist = await getChecklist(event_id);
    for (const item of checklist) {
      const itemUid = await writeReminderFn({
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
