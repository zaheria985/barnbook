import pool from "@/lib/db";

export interface BudgetCategory {
  id: string;
  name: string;
  is_system: boolean;
  is_custom: boolean;
  sort_order: number;
  created_at: string;
  sub_items: SubItem[];
}

export interface SubItem {
  id: string;
  category_id: string;
  label: string;
  sort_order: number;
}

export async function getCategories(): Promise<BudgetCategory[]> {
  const catRes = await pool.query(
    `SELECT id, name, is_system, is_custom, sort_order, created_at
     FROM budget_categories
     ORDER BY sort_order, name`
  );

  const subRes = await pool.query(
    `SELECT id, category_id, label, sort_order
     FROM budget_category_sub_items
     ORDER BY sort_order, label`
  );

  const subItemsByCategory = new Map<string, SubItem[]>();
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

export async function createCategory(name: string): Promise<BudgetCategory> {
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM budget_categories`
  );
  const res = await pool.query(
    `INSERT INTO budget_categories (name, is_custom, sort_order)
     VALUES ($1, true, $2)
     RETURNING id, name, is_system, is_custom, sort_order, created_at`,
    [name, maxOrder.rows[0].next_order]
  );
  return { ...res.rows[0], sub_items: [] };
}

export async function updateCategory(
  id: string,
  data: { name?: string; sort_order?: number }
): Promise<BudgetCategory | null> {
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
    `UPDATE budget_categories SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, is_system, is_custom, sort_order, created_at`,
    values
  );

  if (res.rows.length === 0) return null;
  return { ...res.rows[0], sub_items: [] };
}

export async function deleteCategory(id: string): Promise<boolean> {
  // Check if system category
  const cat = await pool.query(
    `SELECT is_system FROM budget_categories WHERE id = $1`,
    [id]
  );
  if (cat.rows.length === 0) return false;
  if (cat.rows[0].is_system) {
    throw new Error("Cannot delete system category");
  }

  // Check if expenses reference this category
  const expenses = await pool.query(
    `SELECT COUNT(*) FROM expenses WHERE category_id = $1`,
    [id]
  );
  if (parseInt(expenses.rows[0].count) > 0) {
    throw new Error("Cannot delete category with existing expenses");
  }

  const res = await pool.query(
    `DELETE FROM budget_categories WHERE id = $1 AND is_system = false`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function createSubItem(
  categoryId: string,
  label: string
): Promise<SubItem> {
  const maxOrder = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
     FROM budget_category_sub_items WHERE category_id = $1`,
    [categoryId]
  );
  const res = await pool.query(
    `INSERT INTO budget_category_sub_items (category_id, label, sort_order)
     VALUES ($1, $2, $3)
     RETURNING id, category_id, label, sort_order`,
    [categoryId, label, maxOrder.rows[0].next_order]
  );
  return res.rows[0];
}

export async function updateSubItem(
  id: string,
  data: { label?: string; sort_order?: number }
): Promise<SubItem | null> {
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
    `UPDATE budget_category_sub_items SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, category_id, label, sort_order`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteSubItem(id: string): Promise<boolean> {
  // Check if expenses reference this sub-item
  const expenses = await pool.query(
    `SELECT COUNT(*) FROM expenses WHERE sub_item_id = $1`,
    [id]
  );
  if (parseInt(expenses.rows[0].count) > 0) {
    throw new Error("Cannot delete sub-item with existing expenses");
  }

  const res = await pool.query(
    `DELETE FROM budget_category_sub_items WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
