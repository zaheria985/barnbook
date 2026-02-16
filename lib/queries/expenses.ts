import pool from "@/lib/db";

export interface Expense {
  id: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  amount: number;
  vendor: string | null;
  date: string;
  notes: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateExpenseData {
  category_id: string;
  sub_item_id?: string | null;
  amount: number;
  vendor?: string | null;
  date: string;
  notes?: string | null;
  created_by?: string | null;
}

export interface UpdateExpenseData {
  category_id?: string;
  sub_item_id?: string | null;
  amount?: number;
  vendor?: string | null;
  date?: string;
  notes?: string | null;
}

export async function getExpenses(
  yearMonth: string,
  categoryId?: string
): Promise<Expense[]> {
  const conditions = [`TO_CHAR(e.date, 'YYYY-MM') = $1`];
  const params: string[] = [yearMonth];

  if (categoryId) {
    conditions.push(`e.category_id = $2`);
    params.push(categoryId);
  }

  const res = await pool.query(
    `SELECT e.id, e.category_id, bc.name AS category_name,
            e.sub_item_id, bsi.label AS sub_item_label,
            e.amount, e.vendor, e.date, e.notes, e.source, e.created_by, e.created_at
     FROM expenses e
     JOIN budget_categories bc ON bc.id = e.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = e.sub_item_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.date DESC, e.created_at DESC`,
    params
  );
  return res.rows;
}

export async function createExpense(data: CreateExpenseData): Promise<Expense> {
  const res = await pool.query(
    `INSERT INTO expenses (category_id, sub_item_id, amount, vendor, date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.category_id,
      data.sub_item_id || null,
      data.amount,
      data.vendor || null,
      data.date,
      data.notes || null,
      data.created_by || null,
    ]
  );

  const expense = await pool.query(
    `SELECT e.id, e.category_id, bc.name AS category_name,
            e.sub_item_id, bsi.label AS sub_item_label,
            e.amount, e.vendor, e.date, e.notes, e.source, e.created_by, e.created_at
     FROM expenses e
     JOIN budget_categories bc ON bc.id = e.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = e.sub_item_id
     WHERE e.id = $1`,
    [res.rows[0].id]
  );
  return expense.rows[0];
}

export async function updateExpense(
  id: string,
  data: UpdateExpenseData
): Promise<Expense | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (data.category_id !== undefined) {
    fields.push(`category_id = $${idx++}`);
    values.push(data.category_id);
  }
  if (data.sub_item_id !== undefined) {
    fields.push(`sub_item_id = $${idx++}`);
    values.push(data.sub_item_id);
  }
  if (data.amount !== undefined) {
    fields.push(`amount = $${idx++}`);
    values.push(data.amount);
  }
  if (data.vendor !== undefined) {
    fields.push(`vendor = $${idx++}`);
    values.push(data.vendor);
  }
  if (data.date !== undefined) {
    fields.push(`date = $${idx++}`);
    values.push(data.date);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  await pool.query(
    `UPDATE expenses SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );

  const expense = await pool.query(
    `SELECT e.id, e.category_id, bc.name AS category_name,
            e.sub_item_id, bsi.label AS sub_item_label,
            e.amount, e.vendor, e.date, e.notes, e.source, e.created_by, e.created_at
     FROM expenses e
     JOIN budget_categories bc ON bc.id = e.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = e.sub_item_id
     WHERE e.id = $1`,
    [id]
  );
  return expense.rows[0] || null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getVendorSuggestions(query: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT DISTINCT vendor FROM expenses
     WHERE vendor ILIKE $1 AND vendor IS NOT NULL
     ORDER BY vendor
     LIMIT 10`,
    [`${query}%`]
  );
  return res.rows.map((r) => r.vendor);
}
