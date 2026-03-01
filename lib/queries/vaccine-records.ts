import pool from "@/lib/db";

export interface VaccineRecord {
  id: string;
  horse_id: string;
  vaccine_name: string;
  date_administered: string;
  next_due_date: string | null;
  provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function serializeDates(row: Record<string, unknown>): VaccineRecord {
  return {
    ...row,
    date_administered:
      typeof row.date_administered === "string"
        ? row.date_administered
        : (row.date_administered as Date).toISOString().split("T")[0],
    next_due_date: row.next_due_date
      ? typeof row.next_due_date === "string"
        ? row.next_due_date
        : (row.next_due_date as Date).toISOString().split("T")[0]
      : null,
  } as VaccineRecord;
}

export async function getVaccineRecords(
  horseId: string
): Promise<VaccineRecord[]> {
  const res = await pool.query(
    `SELECT id, horse_id, vaccine_name, date_administered, next_due_date,
            provider, notes, created_at, updated_at
     FROM vaccine_records
     WHERE horse_id = $1
     ORDER BY date_administered DESC`,
    [horseId]
  );
  return res.rows.map(serializeDates);
}

export async function createVaccineRecord(data: {
  horse_id: string;
  vaccine_name: string;
  date_administered: string;
  next_due_date?: string | null;
  provider?: string | null;
  notes?: string | null;
}): Promise<VaccineRecord> {
  const res = await pool.query(
    `INSERT INTO vaccine_records (horse_id, vaccine_name, date_administered, next_due_date, provider, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, horse_id, vaccine_name, date_administered, next_due_date,
               provider, notes, created_at, updated_at`,
    [
      data.horse_id,
      data.vaccine_name,
      data.date_administered,
      data.next_due_date ?? null,
      data.provider ?? null,
      data.notes ?? null,
    ]
  );
  return serializeDates(res.rows[0]);
}

export async function updateVaccineRecord(
  id: string,
  data: {
    vaccine_name?: string;
    date_administered?: string;
    next_due_date?: string | null;
    provider?: string | null;
    notes?: string | null;
  }
): Promise<VaccineRecord | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.vaccine_name !== undefined) {
    fields.push(`vaccine_name = $${idx++}`);
    values.push(data.vaccine_name);
  }
  if (data.date_administered !== undefined) {
    fields.push(`date_administered = $${idx++}`);
    values.push(data.date_administered);
  }
  if (data.next_due_date !== undefined) {
    fields.push(`next_due_date = $${idx++}`);
    values.push(data.next_due_date);
  }
  if (data.provider !== undefined) {
    fields.push(`provider = $${idx++}`);
    values.push(data.provider);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE vaccine_records SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, horse_id, vaccine_name, date_administered, next_due_date,
               provider, notes, created_at, updated_at`,
    values
  );

  if (res.rows.length === 0) return null;
  return serializeDates(res.rows[0]);
}

export async function deleteVaccineRecord(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM vaccine_records WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
