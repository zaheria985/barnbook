import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getSuggestedWindows, getIcloudSettings } from "@/lib/queries/icloud-sync";
import * as caldav from "@/lib/caldav";
import { localToday } from "@/lib/dates";
import { withTimeout, TimeoutError } from "@/lib/with-timeout";

/** iCloud is a third-party call with no timeout of its own; cap our wait. */
const ICLOUD_TIMEOUT_MS = 10_000;

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

    // Conditionally fetch iCloud events for the 7-day window. A slow or
    // unreachable iCloud must degrade to "no events" rather than hang the page.
    let ical_events: { uid: string; summary: string; dtstart: string; dtend: string | null; location: string | null }[] = [];
    let ical_status: "ok" | "timeout" | "error" | "unconfigured" = "unconfigured";
    if (caldav.isConfigured()) {
      try {
        const icloudSettings = await getIcloudSettings();
        if (icloudSettings && icloudSettings.read_calendar_ids.length > 0) {
          const from = new Date(today + "T00:00:00");
          const to = new Date(sevenDaysOut + "T00:00:00");
          const events = await withTimeout(
            caldav.fetchEvents(icloudSettings.read_calendar_ids, from, to),
            ICLOUD_TIMEOUT_MS
          );
          ical_events = events.map(e => ({
            uid: e.uid,
            summary: e.summary,
            dtstart: e.dtstart,
            dtend: e.dtend,
            location: e.location,
          }));
          ical_status = "ok";
        }
      } catch (err) {
        ical_status = err instanceof TimeoutError ? "timeout" : "error";
        console.error("Failed to fetch iCloud events for digest:", err);
      }
    }

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
