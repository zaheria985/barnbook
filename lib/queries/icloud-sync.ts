import pool from "@/lib/db";

export interface IcloudSettings {
  id: string;
  read_calendar_ids: string[];
  write_calendar_id: string | null;
  updated_at: string;
}

export interface SyncState {
  id: string;
  ical_uid: string;
  event_id: string | null;
  calendar_id: string;
  last_seen_at: string;
  created_at: string;
}

export interface SuggestedWindow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  weather_score: string;
  weather_notes: string[];
  ical_uid: string | null;
  created_at: string;
}

export async function getIcloudSettings(): Promise<IcloudSettings | null> {
  const res = await pool.query(
    `SELECT id, read_calendar_ids, write_calendar_id, updated_at
     FROM icloud_settings
     LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function updateIcloudSettings(
  readIds: string[],
  writeId: string | null
): Promise<IcloudSettings> {
  // Upsert — only one settings row
  const existing = await getIcloudSettings();
  if (existing) {
    const res = await pool.query(
      `UPDATE icloud_settings
       SET read_calendar_ids = $1, write_calendar_id = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, read_calendar_ids, write_calendar_id, updated_at`,
      [readIds, writeId, existing.id]
    );
    return res.rows[0];
  }

  const res = await pool.query(
    `INSERT INTO icloud_settings (read_calendar_ids, write_calendar_id)
     VALUES ($1, $2)
     RETURNING id, read_calendar_ids, write_calendar_id, updated_at`,
    [readIds, writeId]
  );
  return res.rows[0];
}

export async function getSyncState(icalUid: string): Promise<SyncState | null> {
  const res = await pool.query(
    `SELECT id, ical_uid, event_id, calendar_id, last_seen_at, created_at
     FROM icloud_sync_state
     WHERE ical_uid = $1`,
    [icalUid]
  );
  return res.rows[0] || null;
}

export async function upsertSyncState(
  icalUid: string,
  eventId: string | null,
  calendarId: string
): Promise<SyncState> {
  const res = await pool.query(
    `INSERT INTO icloud_sync_state (ical_uid, event_id, calendar_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (ical_uid) DO UPDATE SET
       event_id = COALESCE($2, icloud_sync_state.event_id),
       calendar_id = $3,
       last_seen_at = now()
     RETURNING id, ical_uid, event_id, calendar_id, last_seen_at, created_at`,
    [icalUid, eventId, calendarId]
  );
  return res.rows[0];
}

export async function getSuggestedWindows(
  from: string,
  to: string
): Promise<SuggestedWindow[]> {
  const res = await pool.query(
    `SELECT id, date, start_time, end_time, weather_score, weather_notes, ical_uid, created_at
     FROM suggested_ride_windows
     WHERE date >= $1 AND date <= $2
     ORDER BY date, start_time`,
    [from, to]
  );
  return res.rows;
}

export async function replaceSuggestedWindows(
  windows: {
    date: string;
    start_time: string;
    end_time: string;
    weather_score: string;
    weather_notes: string[];
    ical_uid: string | null;
  }[]
): Promise<SuggestedWindow[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM suggested_ride_windows");

    const inserted: SuggestedWindow[] = [];
    for (const w of windows) {
      const res = await client.query(
        `INSERT INTO suggested_ride_windows (date, start_time, end_time, weather_score, weather_notes, ical_uid)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, date, start_time, end_time, weather_score, weather_notes, ical_uid, created_at`,
        [w.date, w.start_time, w.end_time, w.weather_score, w.weather_notes, w.ical_uid]
      );
      inserted.push(res.rows[0]);
    }

    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getSuggestedWindow(
  id: string
): Promise<SuggestedWindow | null> {
  const res = await pool.query(
    `SELECT id, date, start_time, end_time, weather_score, weather_notes, ical_uid, created_at
     FROM suggested_ride_windows
     WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function deleteSuggestedWindow(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM suggested_ride_windows WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function cleanupOldSyncState(beforeDate: string): Promise<number> {
  const res = await pool.query(
    `DELETE FROM icloud_sync_state WHERE last_seen_at < $1`,
    [beforeDate]
  );
  return res.rowCount ?? 0;
}
