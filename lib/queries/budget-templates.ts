import pool from "@/lib/db";

export interface BudgetTemplate {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetTemplateItem {
  id: string;
  template_id: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  budgeted_amount: number;
}

export async function getTemplates(): Promise<BudgetTemplate[]> {
  const res = await pool.query(
    `SELECT id, name, is_default, created_at, updated_at
     FROM budget_templates
     ORDER BY is_default DESC, name`
  );
  return res.rows;
}

export async function getTemplateItems(
  templateId: string
): Promise<BudgetTemplateItem[]> {
  const res = await pool.query(
    `SELECT bti.id, bti.template_id, bti.category_id, bc.name AS category_name,
            bti.sub_item_id, bsi.label AS sub_item_label, bti.budgeted_amount
     FROM budget_template_items bti
     JOIN budget_categories bc ON bc.id = bti.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = bti.sub_item_id
     WHERE bti.template_id = $1
     ORDER BY bc.sort_order, bc.name, bsi.sort_order, bsi.label`,
    [templateId]
  );
  return res.rows;
}

export async function setTemplateItem(
  templateId: string,
  categoryId: string,
  subItemId: string | null,
  amount: number
): Promise<BudgetTemplateItem> {
  const existing = await pool.query(
    subItemId
      ? `SELECT id FROM budget_template_items WHERE template_id = $1 AND category_id = $2 AND sub_item_id = $3`
      : `SELECT id FROM budget_template_items WHERE template_id = $1 AND category_id = $2 AND sub_item_id IS NULL`,
    subItemId ? [templateId, categoryId, subItemId] : [templateId, categoryId]
  );

  let id: string;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    await pool.query(
      `UPDATE budget_template_items SET budgeted_amount = $1 WHERE id = $2`,
      [amount, id]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO budget_template_items (template_id, category_id, sub_item_id, budgeted_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [templateId, categoryId, subItemId, amount]
    );
    id = ins.rows[0].id;
  }

  const res = await pool.query(
    `SELECT bti.id, bti.template_id, bti.category_id, bc.name AS category_name,
            bti.sub_item_id, bsi.label AS sub_item_label, bti.budgeted_amount
     FROM budget_template_items bti
     JOIN budget_categories bc ON bc.id = bti.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = bti.sub_item_id
     WHERE bti.id = $1`,
    [id]
  );
  return res.rows[0];
}

export async function createTemplate(name: string): Promise<BudgetTemplate> {
  const res = await pool.query(
    `INSERT INTO budget_templates (name) VALUES ($1)
     RETURNING id, name, is_default, created_at, updated_at`,
    [name]
  );
  return res.rows[0];
}

export async function renameTemplate(
  id: string,
  name: string
): Promise<BudgetTemplate | null> {
  const res = await pool.query(
    `UPDATE budget_templates SET name = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, is_default, created_at, updated_at`,
    [name, id]
  );
  return res.rows[0] || null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM budget_templates WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function cloneTemplate(
  id: string,
  newName: string
): Promise<BudgetTemplate> {
  const tmpl = await pool.query(
    `INSERT INTO budget_templates (name)
     VALUES ($1)
     RETURNING id, name, is_default, created_at, updated_at`,
    [newName]
  );
  const newTemplate = tmpl.rows[0];

  await pool.query(
    `INSERT INTO budget_template_items (template_id, category_id, sub_item_id, budgeted_amount)
     SELECT $1, category_id, sub_item_id, budgeted_amount
     FROM budget_template_items
     WHERE template_id = $2`,
    [newTemplate.id, id]
  );

  return newTemplate;
}

export async function applyTemplateToMonth(
  templateId: string,
  yearMonth: string,
  mode: "fill" | "overwrite"
): Promise<number> {
  if (mode === "overwrite") {
    await pool.query(
      `DELETE FROM monthly_budgets WHERE year_month = $1`,
      [yearMonth]
    );
  }

  const res = await pool.query(
    `INSERT INTO monthly_budgets (year_month, category_id, sub_item_id, budgeted_amount)
     SELECT $1, category_id, sub_item_id, budgeted_amount
     FROM budget_template_items
     WHERE template_id = $2 AND budgeted_amount > 0
     ON CONFLICT (year_month, category_id, sub_item_id) DO NOTHING
     RETURNING id`,
    [yearMonth, templateId]
  );
  return res.rowCount ?? 0;
}

export async function getDefaultTemplate(): Promise<BudgetTemplate | null> {
  const res = await pool.query(
    `SELECT id, name, is_default, created_at, updated_at
     FROM budget_templates
     WHERE is_default = true
     LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function hasTemplates(): Promise<boolean> {
  const res = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM budget_template_items WHERE budgeted_amount > 0
     ) AS has_items`
  );
  return res.rows[0].has_items;
}
