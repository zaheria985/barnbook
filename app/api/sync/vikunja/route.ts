import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as vikunja from "@/lib/vikunja";
import { getEvent } from "@/lib/queries/events";
import { getChecklist } from "@/lib/queries/event-checklists";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!vikunja.isConfigured()) {
    return NextResponse.json(
      { error: "Vikunja not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { event_id, project_id } = body;

    if (!event_id || !project_id) {
      return NextResponse.json(
        { error: "event_id and project_id are required" },
        { status: 400 }
      );
    }

    const event = await getEvent(event_id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Create main task for the event
    const mainTask = await vikunja.createTask({
      title: event.title,
      description: `${event.event_type} | ${event.location || "No location"}`,
      due_date: event.start_date,
      project_id,
    });

    // Store mapping
    await pool.query(
      `INSERT INTO vikunja_task_map (vikunja_task_id, event_id, sync_type)
       VALUES ($1, $2, 'push')`,
      [String(mainTask.id), event_id]
    );

    // Update event with vikunja_task_id
    await pool.query(
      `UPDATE events SET vikunja_task_id = $1 WHERE id = $2`,
      [String(mainTask.id), event_id]
    );

    // Sync checklist items as sub-tasks
    const checklist = await getChecklist(event_id);
    for (const item of checklist) {
      const subTask = await vikunja.createTask({
        title: item.title,
        due_date: item.due_date,
        project_id,
      });

      await pool.query(
        `INSERT INTO vikunja_task_map (vikunja_task_id, checklist_id, sync_type)
         VALUES ($1, $2, 'push')`,
        [String(subTask.id), item.id]
      );

      await pool.query(
        `UPDATE event_checklists SET vikunja_task_id = $1 WHERE id = $2`,
        [String(subTask.id), item.id]
      );
    }

    return NextResponse.json({
      success: true,
      vikunja_task_id: mainTask.id,
      synced_items: checklist.length,
    });
  } catch (error) {
    console.error("Failed to sync to Vikunja:", error);
    return NextResponse.json({ error: "Failed to sync to Vikunja" }, { status: 500 });
  }
}
