import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getSuggestedWindows } from "@/lib/queries/icloud-sync";
import { getIcloudEvents } from "@/lib/icloud-event-cache";
import { localToday } from "@/lib/dates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = localToday();
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const weekFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Start the iCloud fetch alongside the DB queries — it's the slow one.
    const icloudPromise = getIcloudEvents(
      new Date(today + "T00:00:00"),
      new Date(sevenDaysOut + "T00:00:00")
    );

    const [res, confirmedRes, keywordsRes, suggestedWindows] = await Promise.all([
      pool.query(
        `SELECT e.id, e.title, e.event_type, e.start_date, e.end_date,
                e.start_time, e.end_time, e.location, e.notes, e.is_confirmed, e.created_at
         FROM events e
         WHERE e.start_date BETWEEN $1 AND $2
           AND e.is_confirmed = false
         ORDER BY e.start_date`,
        [today, weekFromNow]
      ),
      pool.query(
        `SELECT e.id, e.title, e.event_type, e.start_date, e.end_date,
                e.start_time, e.end_time, e.location, e.notes, e.is_confirmed, e.created_at
         FROM events e
         WHERE e.start_date BETWEEN $1 AND $2
           AND e.is_confirmed = true
         ORDER BY e.start_date`,
        [today, weekFromNow]
      ),
      pool.query(
        `SELECT keyword, suggested_event_type FROM detection_keywords`
      ),
      getSuggestedWindows(today, weekFromNow),
    ]);

    // Cached + timeout-capped; degrades to empty rather than hanging.
    const icloud = await icloudPromise;
    const ical_events = icloud.events.map((e) => ({
      uid: e.uid,
      summary: e.summary,
      dtstart: e.dtstart,
      dtend: e.dtend,
      location: e.location,
    }));
    const ical_status = icloud.status;

    return NextResponse.json({
      upcoming_events: res.rows,
      confirmed_events: confirmedRes.rows,
      suggested_windows: suggestedWindows,
      ical_events,
      ical_status,
      detection_keywords: keywordsRes.rows,
    });
  } catch (error) {
    console.error("Failed to fetch digest:", error);
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }
}
