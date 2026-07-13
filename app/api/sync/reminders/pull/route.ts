import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as caldav from "@/lib/caldav";
import * as radicale from "@/lib/radicale";
import { getIcloudSettings } from "@/lib/queries/icloud-sync";
import { recordSyncRun } from "@/lib/queries/sync-runs";
import pool from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const icloudSettings = await getIcloudSettings();
  const useRadicale = !!icloudSettings?.use_radicale;

  if (!useRadicale && !caldav.isConfigured()) {
    return NextResponse.json(
      { error: "iCloud not configured", configured: false },
      { status: 503 }
    );
  }

  // Resolve the checklists list for whichever backend is active.
  const calendarId = useRadicale
    ? icloudSettings?.radicale_checklists_collection
    : icloudSettings?.reminders_checklists_id;
  if (!calendarId) {
    return NextResponse.json(
      { error: "No Event checklists list configured", configured: false },
      { status: 503 }
    );
  }

  try {
    // Fetch all reminders including completed ones, from the active backend.
    const reminders = useRadicale
      ? await radicale.fetchReminders([calendarId], true)
      : await caldav.fetchReminders([calendarId], true);
    const completedUids = new Set(
      reminders.filter((r) => r.completed).map((r) => r.uid)
    );

    // Find checklist items that are synced but not yet completed locally
    const uncompleted = await pool.query(
      `SELECT id, reminder_uid
       FROM event_checklists
       WHERE reminder_uid IS NOT NULL AND is_completed = false`
    );

    let updated = 0;
    for (const row of uncompleted.rows) {
      if (completedUids.has(row.reminder_uid)) {
        await pool.query(
          `UPDATE event_checklists SET is_completed = true, updated_at = now() WHERE id = $1`,
          [row.id]
        );
        updated++;
      }
    }

    await recordSyncRun("reminders_pull", "success", null, {
      checked: uncompleted.rows.length,
      updated,
    }).catch(() => {});
    return NextResponse.json({
      success: true,
      checked: uncompleted.rows.length,
      updated,
    });
  } catch (error) {
    console.error("Failed to pull reminders:", error);
    await recordSyncRun(
      "reminders_pull",
      "error",
      error instanceof Error ? error.message : String(error)
    ).catch(() => {});
    return NextResponse.json(
      { error: "Failed to pull from iCloud Reminders" },
      { status: 500 }
    );
  }
}
