import pool from "@/lib/db";

export interface TreatmentSchedule {
  id: string;
  name: string;
  horse_id: string | null;
  horse_name: string | null;
  frequency_days: number;
  start_date: string;
  end_date: string | null;
  occurrence_count: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TreatmentReminder {
  id: string;
  schedule_id: string;
  due_date: string;
  reminder_uid: string | null;
  created_at: string;
}

function serializeScheduleDates(row: Record<string, unknown>): TreatmentSchedule {
  return {
    ...row,
    start_date:
      typeof row.start_date === "string"
        ? row.start_date
        : (row.start_date as Date).toISOString().split("T")[0],
    end_date: row.end_date
      ? typeof row.end_date === "string"
        ? row.end_date
        : (row.end_date as Date).toISOString().split("T")[0]
      : null,
  } as TreatmentSchedule;
}

function serializeReminderDates(row: Record<string, unknown>): TreatmentReminder {
  return {
    ...row,
    due_date:
      typeof row.due_date === "string"
        ? row.due_date
        : (row.due_date as Date).toISOString().split("T")[0],
  } as TreatmentReminder;
}

const SCHEDULE_COLUMNS = `
  ts.id, ts.name, ts.horse_id, h.name AS horse_name,
  ts.frequency_days, ts.start_date, ts.end_date,
  ts.occurrence_count, ts.notes, ts.is_active,
  ts.created_at, ts.updated_at
`;

export async function getSchedules(): Promise<TreatmentSchedule[]> {
  const res = await pool.query(
    `SELECT ${SCHEDULE_COLUMNS}
     FROM treatment_schedules ts
     LEFT JOIN horses h ON h.id = ts.horse_id
     WHERE ts.is_active = true
     ORDER BY ts.name`
  );
  return res.rows.map(serializeScheduleDates);
}

export async function getSchedule(id: string): Promise<TreatmentSchedule | null> {
  const res = await pool.query(
    `SELECT ${SCHEDULE_COLUMNS}
     FROM treatment_schedules ts
     LEFT JOIN horses h ON h.id = ts.horse_id
     WHERE ts.id = $1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return serializeScheduleDates(res.rows[0]);
}

export async function getSchedulesForHorse(horseId: string): Promise<TreatmentSchedule[]> {
  const res = await pool.query(
    `SELECT ${SCHEDULE_COLUMNS}
     FROM treatment_schedules ts
     LEFT JOIN horses h ON h.id = ts.horse_id
     WHERE ts.horse_id = $1 AND ts.is_active = true
     ORDER BY ts.name`,
    [horseId]
  );
  return res.rows.map(serializeScheduleDates);
}

export async function createSchedule(data: {
  name: string;
  horse_id?: string | null;
  frequency_days: number;
  start_date: string;
  end_date?: string | null;
  occurrence_count?: number | null;
  notes?: string | null;
}): Promise<TreatmentSchedule> {
  const res = await pool.query(
    `INSERT INTO treatment_schedules (name, horse_id, frequency_days, start_date, end_date, occurrence_count, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.name,
      data.horse_id ?? null,
      data.frequency_days,
      data.start_date,
      data.end_date ?? null,
      data.occurrence_count ?? null,
      data.notes ?? null,
    ]
  );
  const schedule = await getSchedule(res.rows[0].id);
  return schedule!;
}

export async function updateSchedule(
  id: string,
  data: {
    name?: string;
    horse_id?: string | null;
    frequency_days?: number;
    start_date?: string;
    end_date?: string | null;
    occurrence_count?: number | null;
    notes?: string | null;
    is_active?: boolean;
  }
): Promise<TreatmentSchedule | null> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.horse_id !== undefined) {
    fields.push(`horse_id = $${idx++}`);
    values.push(data.horse_id);
  }
  if (data.frequency_days !== undefined) {
    fields.push(`frequency_days = $${idx++}`);
    values.push(data.frequency_days);
  }
  if (data.start_date !== undefined) {
    fields.push(`start_date = $${idx++}`);
    values.push(data.start_date);
  }
  if (data.end_date !== undefined) {
    fields.push(`end_date = $${idx++}`);
    values.push(data.end_date);
  }
  if (data.occurrence_count !== undefined) {
    fields.push(`occurrence_count = $${idx++}`);
    values.push(data.occurrence_count);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(data.is_active);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  await pool.query(
    `UPDATE treatment_schedules SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );
  return getSchedule(id);
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM treatment_schedules WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getReminder(
  scheduleId: string,
  date: string
): Promise<TreatmentReminder | null> {
  const res = await pool.query(
    `SELECT id, schedule_id, due_date, reminder_uid, created_at
     FROM treatment_reminders
     WHERE schedule_id = $1 AND due_date = $2`,
    [scheduleId, date]
  );
  if (res.rows.length === 0) return null;
  return serializeReminderDates(res.rows[0]);
}

export async function createReminder(
  scheduleId: string,
  date: string,
  reminderUid: string | null
): Promise<TreatmentReminder> {
  const res = await pool.query(
    `INSERT INTO treatment_reminders (schedule_id, due_date, reminder_uid)
     VALUES ($1, $2, $3)
     RETURNING id, schedule_id, due_date, reminder_uid, created_at`,
    [scheduleId, date, reminderUid]
  );
  return serializeReminderDates(res.rows[0]);
}

export async function countReminders(scheduleId: string): Promise<number> {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM treatment_reminders
     WHERE schedule_id = $1`,
    [scheduleId]
  );
  return res.rows[0].count;
}

export async function deleteOldReminders(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM treatment_reminders
     WHERE due_date < CURRENT_DATE - 30`
  );
  return res.rowCount ?? 0;
}
