import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as vikunja from "@/lib/vikunja";
import pool from "@/lib/db";

export async function POST() {
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
    // Get all push-synced task mappings
    const mappings = await pool.query(
      `SELECT vtm.id, vtm.vikunja_task_id, vtm.event_id, vtm.checklist_id
       FROM vikunja_task_map vtm
       WHERE vtm.sync_type = 'push'`
    );

    let updated = 0;
    let errors = 0;

    for (const mapping of mappings.rows) {
      try {
        const task = await vikunja.getTask(Number(mapping.vikunja_task_id));

        if (mapping.checklist_id && task.done) {
          // Update local checklist item completion status
          const result = await pool.query(
            `UPDATE event_checklists
             SET is_completed = true, updated_at = now()
             WHERE id = $1 AND is_completed = false`,
            [mapping.checklist_id]
          );
          if ((result.rowCount ?? 0) > 0) updated++;
        }

        // Update sync timestamp
        await pool.query(
          `UPDATE vikunja_task_map SET synced_at = now() WHERE id = $1`,
          [mapping.id]
        );
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: mappings.rows.length,
      updated,
      errors,
    });
  } catch (error) {
    console.error("Failed to pull from Vikunja:", error);
    return NextResponse.json(
      { error: "Failed to pull from Vikunja" },
      { status: 500 }
    );
  }
}
