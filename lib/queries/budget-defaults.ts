import pool from "@/lib/db";

export interface BudgetDefault {
  id: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  budgeted_amount: number;
}

export async function getBudgetDefaults(): Promise<BudgetDefault[]> {
  const res = await pool.query(
    `SELECT bd.id, bd.category_id, bc.name AS category_name,
            bd.sub_item_id, bsi.label AS sub_item_label, bd.budgeted_amount
     FROM budget_defaults bd
     JOIN budget_categories bc ON bc.id = bd.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = bd.sub_item_id
     ORDER BY bc.sort_order, bc.name, bsi.sort_order, bsi.label`
  );
  return res.rows;
}

export async function setBudgetDefault(
  categoryId: string,
  subItemId: string | null,
  amount: number
): Promise<BudgetDefault> {
  const existing = await pool.query(
    subItemId
      ? `SELECT id FROM budget_defaults WHERE category_id = $1 AND sub_item_id = $2`
      : `SELECT id FROM budget_defaults WHERE category_id = $1 AND sub_item_id IS NULL`,
    subItemId ? [categoryId, subItemId] : [categoryId]
  );

  let id: string;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    await pool.query(
      `UPDATE budget_defaults SET budgeted_amount = $1, updated_at = now() WHERE id = $2`,
      [amount, id]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO budget_defaults (category_id, sub_item_id, budgeted_amount)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [categoryId, subItemId, amount]
    );
    id = ins.rows[0].id;
  }

  const res = await pool.query(
    `SELECT bd.id, bd.category_id, bc.name AS category_name,
            bd.sub_item_id, bsi.label AS sub_item_label, bd.budgeted_amount
     FROM budget_defaults bd
     JOIN budget_categories bc ON bc.id = bd.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = bd.sub_item_id
     WHERE bd.id = $1`,
    [id]
  );
  return res.rows[0];
}
