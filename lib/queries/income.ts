import pool from "@/lib/db";

export interface IncomeSource {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MonthlyIncome {
  id: string;
  year_month: string;
  source_id: string;
  source_name: string;
  projected_amount: number;
  actual_amount: number;
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

export async function getMonthlyIncome(
  yearMonth: string
): Promise<MonthlyIncome[]> {
  const res = await pool.query(
    `SELECT mi.id, mi.year_month, mi.source_id, isc.name AS source_name,
            mi.projected_amount, mi.actual_amount
     FROM monthly_income mi
     JOIN income_sources isc ON isc.id = mi.source_id
     WHERE mi.year_month = $1
     ORDER BY isc.sort_order, isc.name`,
    [yearMonth]
  );
  return res.rows;
}

export async function setMonthlyIncome(
  yearMonth: string,
  sourceId: string,
  projected: number,
  actual: number
): Promise<MonthlyIncome> {
  const existing = await pool.query(
    `SELECT id FROM monthly_income WHERE year_month = $1 AND source_id = $2`,
    [yearMonth, sourceId]
  );

  let id: string;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    await pool.query(
      `UPDATE monthly_income
       SET projected_amount = $1, actual_amount = $2, updated_at = now()
       WHERE id = $3`,
      [projected, actual, id]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO monthly_income (year_month, source_id, projected_amount, actual_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [yearMonth, sourceId, projected, actual]
    );
    id = ins.rows[0].id;
  }

  const res = await pool.query(
    `SELECT mi.id, mi.year_month, mi.source_id, isc.name AS source_name,
            mi.projected_amount, mi.actual_amount
     FROM monthly_income mi
     JOIN income_sources isc ON isc.id = mi.source_id
     WHERE mi.id = $1`,
    [id]
  );
  return res.rows[0];
}
