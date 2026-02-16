import pool from "@/lib/db";

export interface Sale {
  id: string;
  description: string;
  amount: number;
  date: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateSaleData {
  description: string;
  amount: number;
  date: string;
  created_by?: string | null;
}

export interface UpdateSaleData {
  description?: string;
  amount?: number;
  date?: string;
}

export async function getSales(yearMonth: string): Promise<Sale[]> {
  const res = await pool.query(
    `SELECT id, description, amount, date, created_by, created_at
     FROM sales
     WHERE TO_CHAR(date, 'YYYY-MM') = $1
     ORDER BY date DESC, created_at DESC`,
    [yearMonth]
  );
  return res.rows;
}

export async function createSale(data: CreateSaleData): Promise<Sale> {
  const res = await pool.query(
    `INSERT INTO sales (description, amount, date, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, description, amount, date, created_by, created_at`,
    [data.description, data.amount, data.date, data.created_by || null]
  );
  return res.rows[0];
}

export async function updateSale(
  id: string,
  data: UpdateSaleData
): Promise<Sale | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (data.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(data.description);
  }
  if (data.amount !== undefined) {
    fields.push(`amount = $${idx++}`);
    values.push(data.amount);
  }
  if (data.date !== undefined) {
    fields.push(`date = $${idx++}`);
    values.push(data.date);
  }

  if (fields.length === 0) return null;

  values.push(id);

  const res = await pool.query(
    `UPDATE sales SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, description, amount, date, created_by, created_at`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteSale(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM sales WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
