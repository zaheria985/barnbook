import pool from "@/lib/db";

export interface SubItemOverview {
  sub_item_id: string | null;
  sub_item_label: string | null;
  budgeted: number;
  spent: number;
}

export interface CategoryOverview {
  category_id: string;
  category_name: string;
  is_system: boolean;
  sort_order: number;
  budgeted: number;
  spent: number;
  sub_items: SubItemOverview[];
}

export interface BudgetOverview {
  categories: CategoryOverview[];
  total_budgeted: number;
  total_spent: number;
}

export async function getBudgetOverview(
  yearMonth: string
): Promise<BudgetOverview> {
  const catRes = await pool.query(
    `SELECT 
       bc.id AS category_id,
       bc.name AS category_name,
       bc.is_system,
       bc.sort_order,
       COALESCE(SUM(mb.budgeted_amount), 0) AS budgeted,
       COALESCE(SUM(e.spent), 0) AS spent
     FROM budget_categories bc
     LEFT JOIN monthly_budgets mb ON mb.category_id = bc.id AND mb.year_month = $1
     LEFT JOIN (
       SELECT category_id, SUM(amount) AS spent
       FROM expenses
       WHERE TO_CHAR(date, 'YYYY-MM') = $1
       GROUP BY category_id
     ) e ON e.category_id = bc.id
     GROUP BY bc.id, bc.name, bc.is_system, bc.sort_order
     ORDER BY bc.sort_order, bc.name`,
    [yearMonth]
  );

  const subRes = await pool.query(
    `SELECT 
       bc.id AS category_id,
       bsi.id AS sub_item_id,
       bsi.label AS sub_item_label,
       COALESCE(mb.budgeted_amount, 0) AS budgeted,
       COALESCE(e.spent, 0) AS spent
     FROM budget_categories bc
     JOIN budget_category_sub_items bsi ON bsi.category_id = bc.id
     LEFT JOIN monthly_budgets mb ON mb.sub_item_id = bsi.id AND mb.year_month = $1
     LEFT JOIN (
       SELECT sub_item_id, SUM(amount) AS spent
       FROM expenses
       WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND sub_item_id IS NOT NULL
       GROUP BY sub_item_id
     ) e ON e.sub_item_id = bsi.id
     ORDER BY bsi.sort_order, bsi.label`,
    [yearMonth]
  );

  const subItemsByCategory = new Map<string, SubItemOverview[]>();
  for (const row of subRes.rows) {
    const list = subItemsByCategory.get(row.category_id) || [];
    list.push({
      sub_item_id: row.sub_item_id,
      sub_item_label: row.sub_item_label,
      budgeted: Number(row.budgeted),
      spent: Number(row.spent),
    });
    subItemsByCategory.set(row.category_id, list);
  }

  const categories: CategoryOverview[] = catRes.rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    is_system: row.is_system,
    sort_order: row.sort_order,
    budgeted: Number(row.budgeted),
    spent: Number(row.spent),
    sub_items: subItemsByCategory.get(row.category_id) || [],
  }));

  const total_budgeted = categories.reduce((s, c) => s + c.budgeted, 0);
  const total_spent = categories.reduce((s, c) => s + c.spent, 0);

  return { categories, total_budgeted, total_spent };
}

export async function getSavingsBalance(): Promise<number> {
  const res = await pool.query(
    `SELECT balance FROM horse_savings_account LIMIT 1`
  );
  return res.rows[0]?.balance || 0;
}

export async function getPreviousMonthBalance(
  yearMonth: string
): Promise<{ deficit_carryover: number; is_closed: boolean } | null> {
  const [year, month] = yearMonth.split("-").map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(
    prevDate.getMonth() + 1
  ).padStart(2, "0")}`;

  const res = await pool.query(
    `SELECT deficit_carryover, is_closed FROM monthly_balances WHERE year_month = $1`,
    [prevMonth]
  );
  return res.rows[0] || null;
}
