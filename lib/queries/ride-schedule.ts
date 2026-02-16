import pool from "@/lib/db";

export interface RideSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableWindow {
  date: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  has_conflict: boolean;
  conflict_title: string | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "";
}

export async function getSchedule(): Promise<RideSlot[]> {
  const res = await pool.query(
    `SELECT id, day_of_week, start_time, end_time, created_at, updated_at
     FROM ride_schedule
     ORDER BY day_of_week, start_time`
  );
  return res.rows;
}

export async function createSlot(data: {
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<RideSlot> {
  const res = await pool.query(
    `INSERT INTO ride_schedule (day_of_week, start_time, end_time)
     VALUES ($1, $2, $3)
     RETURNING id, day_of_week, start_time, end_time, created_at, updated_at`,
    [data.day_of_week, data.start_time, data.end_time]
  );
  return res.rows[0];
}

export async function updateSlot(
  id: string,
  data: { day_of_week?: number; start_time?: string; end_time?: string }
): Promise<RideSlot | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (data.day_of_week !== undefined) {
    fields.push(`day_of_week = $${idx++}`);
    values.push(data.day_of_week);
  }
  if (data.start_time !== undefined) {
    fields.push(`start_time = $${idx++}`);
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    fields.push(`end_time = $${idx++}`);
    values.push(data.end_time);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE ride_schedule SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, day_of_week, start_time, end_time, created_at, updated_at`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM ride_schedule WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getAvailableWindows(
  from: string,
  to: string
): Promise<AvailableWindow[]> {
  // Get all schedule slots
  const slotsRes = await pool.query(
    `SELECT day_of_week, start_time, end_time FROM ride_schedule ORDER BY day_of_week, start_time`
  );

  // Get events in the range to find conflicts
  const eventsRes = await pool.query(
    `SELECT title, start_date, end_date FROM events
     WHERE start_date <= $2 AND COALESCE(end_date, start_date) >= $1
     ORDER BY start_date`,
    [from, to]
  );

  const windows: AvailableWindow[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dateStr = d.toISOString().split("T")[0];

    for (const slot of slotsRes.rows) {
      if (slot.day_of_week !== dow) continue;

      // Check for event conflicts on this date
      const conflict = eventsRes.rows.find((e: { start_date: string; end_date: string | null }) => {
        const eStart = e.start_date.split("T")[0];
        const eEnd = (e.end_date || e.start_date).split("T")[0];
        return dateStr >= eStart && dateStr <= eEnd;
      });

      windows.push({
        date: dateStr,
        day_of_week: dow,
        start_time: slot.start_time,
        end_time: slot.end_time,
        has_conflict: !!conflict,
        conflict_title: conflict?.title || null,
      });
    }
  }

  return windows;
}
