import pool from "@/lib/db";

export interface VetRecord {
  id: string;
  horse_id: string;
  visit_date: string;
  provider: string | null;
  reason: string | null;
  notes: string | null;
  cost: string | null; // DECIMAL comes back as string from pg
  created_at: string;
  updated_at: string;
}

function serializeDates(row: Record<string, unknown>): VetRecord {
  return {
    ...row,
    visit_date:
      typeof row.visit_date === "string"
        ? row.visit_date
        : (row.visit_date as Date).toISOString().split("T")[0],
  } as VetRecord;
}

export async function getVetRecords(horseId: string): Promise<VetRecord[]> {
  const res = await pool.query(
    `SELECT id, horse_id, visit_date, provider, reason, notes, cost, created_at, updated_at
     FROM vet_records
     WHERE horse_id = $1
     ORDER BY visit_date DESC`,
    [horseId]
  );
  return res.rows.map(serializeDates);
}

export async function createVetRecord(data: {
  horse_id: string;
  visit_date: string;
  provider?: string | null;
  reason?: string | null;
  notes?: string | null;
  cost?: number | null;
}): Promise<VetRecord> {
  const res = await pool.query(
    `INSERT INTO vet_records (horse_id, visit_date, provider, reason, notes, cost)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, horse_id, visit_date, provider, reason, notes, cost, created_at, updated_at`,
    [
      data.horse_id,
      data.visit_date,
      data.provider ?? null,
      data.reason ?? null,
      data.notes ?? null,
      data.cost ?? null,
    ]
  );
  return serializeDates(res.rows[0]);
}

export async function updateVetRecord(
  id: string,
  data: {
    visit_date?: string;
    provider?: string | null;
    reason?: string | null;
    notes?: string | null;
    cost?: number | null;
  }
): Promise<VetRecord | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (data.visit_date !== undefined) {
    fields.push(`visit_date = $${idx++}`);
    values.push(data.visit_date);
  }
  if (data.provider !== undefined) {
    fields.push(`provider = $${idx++}`);
    values.push(data.provider);
  }
  if (data.reason !== undefined) {
    fields.push(`reason = $${idx++}`);
    values.push(data.reason);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }
  if (data.cost !== undefined) {
    fields.push(`cost = $${idx++}`);
    values.push(data.cost);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE vet_records SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, horse_id, visit_date, provider, reason, notes, cost, created_at, updated_at`,
    values
  );
  if (res.rows.length === 0) return null;
  return serializeDates(res.rows[0]);
}

export async function deleteVetRecord(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM vet_records WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
