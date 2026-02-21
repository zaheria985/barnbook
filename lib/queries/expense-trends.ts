import pool from "@/lib/db";

export interface SpendingTrend {
  category_id: string;
  sub_item_id: string | null;
  month: string; // "2026-01"
  spent: number;
}

export async function getCategorySpendingTrends(
  months: number = 12
): Promise<SpendingTrend[]> {
  const res = await pool.query(
    `SELECT
       category_id,
       sub_item_id,
       TO_CHAR(date, 'YYYY-MM') AS month,
       SUM(amount)::numeric AS spent
     FROM expenses
     WHERE date >= date_trunc('month', now()) - make_interval(months => $1)
     GROUP BY category_id, sub_item_id, TO_CHAR(date, 'YYYY-MM')
     ORDER BY month`,
    [months - 1]
  );

  return res.rows.map((row) => ({
    category_id: row.category_id,
    sub_item_id: row.sub_item_id ?? null,
    month: row.month,
    spent: Number(row.spent),
  }));
}
