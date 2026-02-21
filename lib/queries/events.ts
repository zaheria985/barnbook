import pool from "@/lib/db";

export interface Event {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  entry_due_date: string | null;
  notes: string | null;
  checklist_template_id: string | null;
  vikunja_task_id: string | null;
  is_confirmed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  title: string;
  event_type: string;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  entry_due_date?: string | null;
  notes?: string | null;
  checklist_template_id?: string | null;
  created_by?: string | null;
  is_confirmed?: boolean;
}

export interface UpdateEventData {
  title?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  entry_due_date?: string | null;
  notes?: string | null;
  checklist_template_id?: string | null;
  vikunja_task_id?: string | null;
  is_confirmed?: boolean;
}

const EVENT_COLUMNS = `id, title, event_type, start_date, end_date, start_time, end_time,
            location, entry_due_date, notes, checklist_template_id, vikunja_task_id,
            is_confirmed, created_by, created_at, updated_at`;

export async function getEvents(from?: string, to?: string): Promise<Event[]> {
  const conditions: string[] = [];
  const values: string[] = [];
  let idx = 1;

  if (from) {
    conditions.push(`start_date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`start_date <= $${idx++}`);
    values.push(to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT ${EVENT_COLUMNS}
     FROM events ${where}
     ORDER BY start_date, start_time NULLS LAST, title`,
    values
  );
  return res.rows;
}

export async function getEvent(id: string): Promise<Event | null> {
  const res = await pool.query(
    `SELECT ${EVENT_COLUMNS}
     FROM events WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createEvent(data: CreateEventData): Promise<Event> {
  const res = await pool.query(
    `INSERT INTO events (title, event_type, start_date, end_date, start_time, end_time,
                         location, entry_due_date, notes, checklist_template_id, created_by,
                         is_confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${EVENT_COLUMNS}`,
    [
      data.title,
      data.event_type,
      data.start_date,
      data.end_date ?? null,
      data.start_time ?? null,
      data.end_time ?? null,
      data.location ?? null,
      data.entry_due_date ?? null,
      data.notes ?? null,
      data.checklist_template_id ?? null,
      data.created_by ?? null,
      data.is_confirmed ?? false,
    ]
  );
  return res.rows[0];
}

export async function updateEvent(
  id: string,
  data: UpdateEventData
): Promise<Event | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(data.title);
  }
  if (data.event_type !== undefined) {
    fields.push(`event_type = $${idx++}`);
    values.push(data.event_type);
  }
  if (data.start_date !== undefined) {
    fields.push(`start_date = $${idx++}`);
    values.push(data.start_date);
  }
  if (data.end_date !== undefined) {
    fields.push(`end_date = $${idx++}`);
    values.push(data.end_date);
  }
  if (data.start_time !== undefined) {
    fields.push(`start_time = $${idx++}`);
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    fields.push(`end_time = $${idx++}`);
    values.push(data.end_time);
  }
  if (data.location !== undefined) {
    fields.push(`location = $${idx++}`);
    values.push(data.location);
  }
  if (data.entry_due_date !== undefined) {
    fields.push(`entry_due_date = $${idx++}`);
    values.push(data.entry_due_date);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }
  if (data.checklist_template_id !== undefined) {
    fields.push(`checklist_template_id = $${idx++}`);
    values.push(data.checklist_template_id);
  }
  if (data.vikunja_task_id !== undefined) {
    fields.push(`vikunja_task_id = $${idx++}`);
    values.push(data.vikunja_task_id);
  }
  if (data.is_confirmed !== undefined) {
    fields.push(`is_confirmed = $${idx++}`);
    values.push(String(data.is_confirmed));
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE events SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING ${EVENT_COLUMNS}`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM events WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
