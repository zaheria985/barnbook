import pool from "@/lib/db";

export interface IncomeSource {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export async function getIncomeSources(): Promise<IncomeSource[]> {
  const res = await pool.query(
    `SELECT id, name, sort_order, created_at
     FROM income_sources
     ORDER BY sort_order, name`
  );
  return res.rows;
}

export async function createIncomeSource(name: string): Promise<IncomeSource> {
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM income_sources`
  );
  const res = await pool.query(
    `INSERT INTO income_sources (name, sort_order)
     VALUES ($1, $2)
     RETURNING id, name, sort_order, created_at`,
    [name, maxOrder.rows[0].next_order]
  );
  return res.rows[0];
}

export async function updateIncomeSource(
  id: string,
  data: { name?: string; sort_order?: number }
): Promise<IncomeSource | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(data.sort_order);
  }

  if (fields.length === 0) return null;

  values.push(id);
  const res = await pool.query(
    `UPDATE income_sources SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, sort_order, created_at`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteIncomeSource(id: string): Promise<boolean> {
  // Check if monthly_income references this source
  const refs = await pool.query(
    `SELECT COUNT(*) FROM monthly_income WHERE source_id = $1`,
    [id]
  );
  if (parseInt(refs.rows[0].count) > 0) {
    throw new Error("Cannot delete income source with existing monthly income records");
  }

  const res = await pool.query(
    `DELETE FROM income_sources WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
