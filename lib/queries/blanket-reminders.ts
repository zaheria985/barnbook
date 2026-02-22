import pool from "@/lib/db";

export interface BlanketReminder {
  id: string;
  date: string;
  overnight_low_f: number;
  reminder_uid: string | null;
  created_at: string;
}

export async function getReminder(date: string): Promise<BlanketReminder | null> {
  const res = await pool.query(
    `SELECT id, date, overnight_low_f, reminder_uid, created_at
     FROM blanket_reminders
     WHERE date = $1`,
    [date]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    date: typeof row.date === "string" ? row.date : row.date.toISOString().split("T")[0],
  };
}

export async function createReminder(
  date: string,
  lowF: number,
  reminderUid: string | null
): Promise<BlanketReminder> {
  const res = await pool.query(
    `INSERT INTO blanket_reminders (date, overnight_low_f, reminder_uid)
     VALUES ($1, $2, $3)
     RETURNING id, date, overnight_low_f, reminder_uid, created_at`,
    [date, lowF, reminderUid]
  );
  const row = res.rows[0];
  return {
    ...row,
    date: typeof row.date === "string" ? row.date : row.date.toISOString().split("T")[0],
  };
}

export async function deleteOldReminders(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM blanket_reminders
     WHERE date < CURRENT_DATE - 7`
  );
  return res.rowCount ?? 0;
}
