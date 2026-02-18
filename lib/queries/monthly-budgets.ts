import pool from "@/lib/db";

export interface MonthlyBudget {
  id: string;
  year_month: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  budgeted_amount: number;
}

export async function getMonthlyBudgets(
  yearMonth: string
): Promise<MonthlyBudget[]> {
  const res = await pool.query(
    `SELECT mb.id, mb.year_month, mb.category_id, bc.name AS category_name,
            mb.sub_item_id, bsi.label AS sub_item_label, mb.budgeted_amount
     FROM monthly_budgets mb
     JOIN budget_categories bc ON bc.id = mb.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = mb.sub_item_id
     WHERE mb.year_month = $1
     ORDER BY bc.sort_order, bc.name, bsi.sort_order, bsi.label`,
    [yearMonth]
  );
  return res.rows;
}

export async function setMonthlyBudget(
  yearMonth: string,
  categoryId: string,
  subItemId: string | null,
  amount: number
): Promise<MonthlyBudget> {
  const existing = await pool.query(
    subItemId
      ? `SELECT id FROM monthly_budgets WHERE year_month = $1 AND category_id = $2 AND sub_item_id = $3`
      : `SELECT id FROM monthly_budgets WHERE year_month = $1 AND category_id = $2 AND sub_item_id IS NULL`,
    subItemId ? [yearMonth, categoryId, subItemId] : [yearMonth, categoryId]
  );

  let id: string;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    await pool.query(
      `UPDATE monthly_budgets SET budgeted_amount = $1, updated_at = now() WHERE id = $2`,
      [amount, id]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO monthly_budgets (year_month, category_id, sub_item_id, budgeted_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [yearMonth, categoryId, subItemId, amount]
    );
    id = ins.rows[0].id;
  }

  const res = await pool.query(
    `SELECT mb.id, mb.year_month, mb.category_id, bc.name AS category_name,
            mb.sub_item_id, bsi.label AS sub_item_label, mb.budgeted_amount
     FROM monthly_budgets mb
     JOIN budget_categories bc ON bc.id = mb.category_id
     LEFT JOIN budget_category_sub_items bsi ON bsi.id = mb.sub_item_id
     WHERE mb.id = $1`,
    [id]
  );
  return res.rows[0];
}

export async function copyBudgetsFromDefaults(
  yearMonth: string
): Promise<number> {
  const existingCount = await pool.query(
    `SELECT COUNT(*) FROM monthly_budgets WHERE year_month = $1`,
    [yearMonth]
  );

  if (parseInt(existingCount.rows[0].count) > 0) {
    return 0;
  }

  // Try to copy from budget_defaults template
  const defaultsExist = await pool.query(
    `SELECT COUNT(*) FROM budget_defaults WHERE budgeted_amount > 0`
  );

  if (parseInt(defaultsExist.rows[0].count) > 0) {
    const res = await pool.query(
      `INSERT INTO monthly_budgets (year_month, category_id, sub_item_id, budgeted_amount)
       SELECT $1, category_id, sub_item_id, budgeted_amount
       FROM budget_defaults
       WHERE budgeted_amount > 0
       RETURNING id`,
      [yearMonth]
    );
    return res.rowCount ?? 0;
  }

  // No defaults — leave empty
  return 0;
}

export async function isMonthClosed(yearMonth: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT is_closed FROM monthly_balances WHERE year_month = $1`,
    [yearMonth]
  );
  return res.rows.length > 0 && res.rows[0].is_closed;
}
