import pool from "@/lib/db";

export interface IncomeCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  sub_items: IncomeSubItem[];
}

export interface IncomeSubItem {
  id: string;
  category_id: string;
  label: string;
  sort_order: number;
}

export interface MonthlyIncome {
  id: string;
  year_month: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  projected_amount: number;
  actual_amount: number;
}

// ── Category CRUD ──

export async function getIncomeCategories(): Promise<IncomeCategory[]> {
  const catRes = await pool.query(
    `SELECT id, name, sort_order, created_at
     FROM income_categories
     ORDER BY sort_order, name`
  );

  const subRes = await pool.query(
    `SELECT id, category_id, label, sort_order
     FROM income_sub_items
     ORDER BY sort_order, label`
  );

  const subItemsByCategory = new Map<string, IncomeSubItem[]>();
  for (const row of subRes.rows) {
    const list = subItemsByCategory.get(row.category_id) || [];
    list.push(row);
    subItemsByCategory.set(row.category_id, list);
  }

  return catRes.rows.map((cat) => ({
    ...cat,
    sub_items: subItemsByCategory.get(cat.id) || [],
  }));
}

export async function createIncomeCategory(name: string): Promise<IncomeCategory> {
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM income_categories`
  );
  const res = await pool.query(
    `INSERT INTO income_categories (name, sort_order)
     VALUES ($1, $2)
     RETURNING id, name, sort_order, created_at`,
    [name, maxOrder.rows[0].next_order]
  );
  return { ...res.rows[0], sub_items: [] };
}

export async function updateIncomeCategory(
  id: string,
  data: { name?: string; sort_order?: number }
): Promise<IncomeCategory | null> {
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
    `UPDATE income_categories SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, sort_order, created_at`,
    values
  );
  if (res.rows.length === 0) return null;
  return { ...res.rows[0], sub_items: [] };
}

export async function deleteIncomeCategory(id: string): Promise<boolean> {
  const refs = await pool.query(
    `SELECT COUNT(*) FROM monthly_income WHERE category_id = $1`,
    [id]
  );
  if (parseInt(refs.rows[0].count) > 0) {
    throw new Error("Cannot delete income category with existing monthly income records");
  }

  const res = await pool.query(
    `DELETE FROM income_categories WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

// ── Sub-item CRUD ──

export async function createIncomeSubItem(
  categoryId: string,
  label: string
): Promise<IncomeSubItem> {
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
     FROM income_sub_items WHERE category_id = $1`,
    [categoryId]
  );
  const res = await pool.query(
    `INSERT INTO income_sub_items (category_id, label, sort_order)
     VALUES ($1, $2, $3)
     RETURNING id, category_id, label, sort_order`,
    [categoryId, label, maxOrder.rows[0].next_order]
  );
  return res.rows[0];
}

export async function updateIncomeSubItem(
  id: string,
  data: { label?: string; sort_order?: number }
): Promise<IncomeSubItem | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (data.label !== undefined) {
    fields.push(`label = $${idx++}`);
    values.push(data.label);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(data.sort_order);
  }

  if (fields.length === 0) return null;

  values.push(id);
  const res = await pool.query(
    `UPDATE income_sub_items SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, category_id, label, sort_order`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteIncomeSubItem(id: string): Promise<boolean> {
  const refs = await pool.query(
    `SELECT COUNT(*) FROM monthly_income WHERE sub_item_id = $1`,
    [id]
  );
  if (parseInt(refs.rows[0].count) > 0) {
    throw new Error("Cannot delete sub-item with existing monthly income records");
  }

  const res = await pool.query(
    `DELETE FROM income_sub_items WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

// ── Monthly Income ──

export async function getMonthlyIncome(
  yearMonth: string
): Promise<MonthlyIncome[]> {
  const res = await pool.query(
    `SELECT mi.id, mi.year_month, mi.category_id, ic.name AS category_name,
            mi.sub_item_id, isi.label AS sub_item_label,
            mi.projected_amount, mi.actual_amount
     FROM monthly_income mi
     JOIN income_categories ic ON ic.id = mi.category_id
     LEFT JOIN income_sub_items isi ON isi.id = mi.sub_item_id
     WHERE mi.year_month = $1
     ORDER BY ic.sort_order, ic.name, isi.sort_order, isi.label`,
    [yearMonth]
  );
  return res.rows;
}

export async function setMonthlyIncome(
  yearMonth: string,
  categoryId: string,
  subItemId: string | null,
  projected: number,
  actual: number
): Promise<MonthlyIncome> {
  const existing = await pool.query(
    subItemId
      ? `SELECT id FROM monthly_income WHERE year_month = $1 AND category_id = $2 AND sub_item_id = $3`
      : `SELECT id FROM monthly_income WHERE year_month = $1 AND category_id = $2 AND sub_item_id IS NULL`,
    subItemId ? [yearMonth, categoryId, subItemId] : [yearMonth, categoryId]
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
      `INSERT INTO monthly_income (year_month, category_id, sub_item_id, projected_amount, actual_amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [yearMonth, categoryId, subItemId, projected, actual]
    );
    id = ins.rows[0].id;
  }

  const res = await pool.query(
    `SELECT mi.id, mi.year_month, mi.category_id, ic.name AS category_name,
            mi.sub_item_id, isi.label AS sub_item_label,
            mi.projected_amount, mi.actual_amount
     FROM monthly_income mi
     JOIN income_categories ic ON ic.id = mi.category_id
     LEFT JOIN income_sub_items isi ON isi.id = mi.sub_item_id
     WHERE mi.id = $1`,
    [id]
  );
  return res.rows[0];
}

// ── Income Trends ──

export interface IncomeTrend {
  month: string; // "2026-01"
  income: number;
  sales: number;
}

export async function getIncomeTrends(
  months: number = 12
): Promise<IncomeTrend[]> {
  // Generate trailing N months as YYYY-MM strings
  const monthList: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthList.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const [incomeRes, salesRes] = await Promise.all([
    pool.query(
      `SELECT year_month AS month, SUM(actual_amount)::numeric AS total
       FROM monthly_income
       WHERE year_month >= $1
       GROUP BY year_month
       ORDER BY year_month`,
      [monthList[0]]
    ),
    pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month, SUM(amount)::numeric AS total
       FROM sales
       WHERE date >= date_trunc('month', now()) - make_interval(months => $1)
       GROUP BY TO_CHAR(date, 'YYYY-MM')
       ORDER BY month`,
      [months - 1]
    ),
  ]);

  const incomeByMonth = new Map<string, number>();
  for (const row of incomeRes.rows) {
    incomeByMonth.set(row.month, Number(row.total));
  }

  const salesByMonth = new Map<string, number>();
  for (const row of salesRes.rows) {
    salesByMonth.set(row.month, Number(row.total));
  }

  return monthList.map((m) => ({
    month: m,
    income: incomeByMonth.get(m) || 0,
    sales: salesByMonth.get(m) || 0,
  }));
}
