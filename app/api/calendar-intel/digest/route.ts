import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getSuggestedWindows } from "@/lib/queries/icloud-sync";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get events from the next 7 days that haven't been confirmed/dismissed
    // and match detection keywords
    const today = new Date().toISOString().split("T")[0];
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const [res, keywordsRes, suggestedWindows] = await Promise.all([
      pool.query(
        `SELECT e.id, e.title, e.event_type, e.start_date, e.end_date,
                e.location, e.notes, e.is_confirmed, e.created_at
         FROM events e
         WHERE e.start_date BETWEEN $1 AND $2
           AND e.is_confirmed = false
         ORDER BY e.start_date`,
        [today, weekFromNow]
      ),
      pool.query(
        `SELECT keyword, suggested_event_type FROM detection_keywords`
      ),
      getSuggestedWindows(today, weekFromNow),
    ]);

    return NextResponse.json({
      upcoming_events: res.rows,
      detection_keywords: keywordsRes.rows,
      suggested_windows: suggestedWindows,
    });
  } catch (error) {
    console.error("Failed to fetch digest:", error);
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }
}
