import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getIcloudEvents } from "@/lib/icloud-event-cache";

const MAX_RANGE_DAYS = 62;

/**
 * Raw iCloud events for a date range, for display on the calendar month grid
 * and the home dashboard.
 *
 * Events the 2-hourly sync has already imported as live barn events are
 * excluded — the barn copy renders through the normal events pipeline, and
 * without this the merged view would show them twice. If the barn copy was
 * deleted (event_id is NULL), the raw iCloud event shows again, which is
 * what you'd expect.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (
    !from ||
    !to ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return NextResponse.json(
      { error: "from and to are required as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T00:00:00");
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
  if (rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Range must be 0-${MAX_RANGE_DAYS} days` },
      { status: 400 }
    );
  }

  try {
    const [icloud, importedRes] = await Promise.all([
      getIcloudEvents(fromDate, toDate),
      pool.query(
        `SELECT ical_uid FROM icloud_sync_state WHERE event_id IS NOT NULL`
      ),
    ]);

    if (icloud.status === "unconfigured") {
      return NextResponse.json({ configured: false, events: [], fetched_at: null });
    }

    const importedUids = new Set(
      importedRes.rows.map((r: { ical_uid: string }) => r.ical_uid)
    );

    const events = icloud.events
      .filter((e) => !importedUids.has(e.uid))
      .map((e) => ({
        uid: e.uid,
        summary: e.summary,
        dtstart: e.dtstart,
        dtend: e.dtend,
        location: e.location,
      }));

    return NextResponse.json({
      configured: true,
      status: icloud.status,
      events,
      fetched_at: icloud.fetchedAt,
    });
  } catch (error) {
    console.error("Failed to fetch iCloud events:", error);
    return NextResponse.json(
      { error: "Failed to fetch iCloud events" },
      { status: 500 }
    );
  }
}
