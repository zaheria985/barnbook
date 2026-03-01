import pool from "@/lib/db";

export type RecurrenceRule = "weekly" | "biweekly" | "monthly" | "yearly";

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
  reminder_uid: string | null;
  is_confirmed: boolean;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: string | null;
  is_recurring_instance: boolean;
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
  recurrence_rule?: RecurrenceRule | null;
  recurrence_parent_id?: string | null;
  is_recurring_instance?: boolean;
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
  reminder_uid?: string | null;
  is_confirmed?: boolean;
  recurrence_rule?: RecurrenceRule | null;
}

const EVENT_COLUMNS = `id, title, event_type, start_date, end_date, start_time, end_time,
            location, entry_due_date, notes, checklist_template_id, reminder_uid,
            is_confirmed, recurrence_rule, recurrence_parent_id, is_recurring_instance,
            created_by, created_at, updated_at`;

export async function getEvents(from?: string, to?: string): Promise<Event[]> {
  const conditions: string[] = [];
  const values: string[] = [];
  let idx = 1;

  if (from) {
    // Include events that start in range OR span into the range (end_date >= from)
    conditions.push(`(start_date >= $${idx} OR end_date >= $${idx})`);
    values.push(from);
    idx++;
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
                         is_confirmed, recurrence_rule, recurrence_parent_id, is_recurring_instance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      data.recurrence_rule ?? null,
      data.recurrence_parent_id ?? null,
      data.is_recurring_instance ?? false,
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
  if (data.reminder_uid !== undefined) {
    fields.push(`reminder_uid = $${idx++}`);
    values.push(data.reminder_uid);
  }
  if (data.is_confirmed !== undefined) {
    fields.push(`is_confirmed = $${idx++}`);
    values.push(String(data.is_confirmed));
  }
  if (data.recurrence_rule !== undefined) {
    fields.push(`recurrence_rule = $${idx++}`);
    values.push(data.recurrence_rule);
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

function addInterval(dateStr: string, rule: RecurrenceRule): string {
  const d = new Date(dateStr + "T12:00:00Z");
  switch (rule) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "biweekly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

export async function generateRecurringInstances(
  parentEvent: Event,
  endDate?: string
): Promise<Event[]> {
  const rule = parentEvent.recurrence_rule;
  if (!rule) return [];

  // Default horizon: 3 months from parent start date
  const horizon = endDate
    ? endDate
    : (() => {
        const d = new Date(String(parentEvent.start_date).split("T")[0] + "T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + 3);
        return d.toISOString().split("T")[0];
      })();

  const instances: Event[] = [];
  let currentDate = addInterval(String(parentEvent.start_date).split("T")[0], rule);

  // Calculate duration offset if parent has end_date
  let durationDays = 0;
  if (parentEvent.end_date) {
    const startMs = new Date(String(parentEvent.start_date).split("T")[0] + "T12:00:00Z").getTime();
    const endMs = new Date(String(parentEvent.end_date).split("T")[0] + "T12:00:00Z").getTime();
    durationDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  }

  while (currentDate <= horizon) {
    let instanceEndDate: string | null = null;
    if (durationDays > 0) {
      const ed = new Date(currentDate + "T12:00:00Z");
      ed.setUTCDate(ed.getUTCDate() + durationDays);
      instanceEndDate = ed.toISOString().split("T")[0];
    }

    const instance = await createEvent({
      title: parentEvent.title,
      event_type: parentEvent.event_type,
      start_date: currentDate,
      end_date: instanceEndDate,
      start_time: parentEvent.start_time,
      end_time: parentEvent.end_time,
      location: parentEvent.location,
      notes: parentEvent.notes,
      created_by: parentEvent.created_by,
      is_confirmed: parentEvent.is_confirmed,
      recurrence_parent_id: parentEvent.id,
      is_recurring_instance: true,
    });
    instances.push(instance);
    currentDate = addInterval(currentDate, rule);
  }

  return instances;
}

export async function deleteFutureInstances(parentId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const res = await pool.query(
    `DELETE FROM events WHERE recurrence_parent_id = $1 AND start_date >= $2`,
    [parentId, today]
  );
  return res.rowCount ?? 0;
}

export async function updateFutureInstances(
  parentId: string,
  data: UpdateEventData
): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0];
  const res = await pool.query(
    `SELECT id FROM events WHERE recurrence_parent_id = $1 AND start_date >= $2 ORDER BY start_date`,
    [parentId, today]
  );

  const updated: Event[] = [];
  for (const row of res.rows) {
    const evt = await updateEvent(row.id, data);
    if (evt) updated.push(evt);
  }
  return updated;
}
