import pool from "@/lib/db";

export interface YearlyMonthRow {
  month: string; // "2026-01"
  budgeted: number;
  spent: number;
  income: number;
  sales: number;
}

export interface YearlySummary {
  year: number;
  months: YearlyMonthRow[];
  total_budgeted: number;
  total_spent: number;
  total_income: number;
  total_sales: number;
  category_totals: { category_name: string; spent: number }[];
}

export async function getYearlySummary(year: number): Promise<YearlySummary> {
  const yearStr = String(year);
  const monthPattern = `${yearStr}-%`;

  // Monthly spending and budgets
  const monthlyRes = await pool.query(
    `SELECT
       m.month,
       COALESCE(b.budgeted, 0) AS budgeted,
       COALESCE(e.spent, 0) AS spent,
       COALESCE(i.income, 0) AS income,
       COALESCE(s.sales, 0) AS sales
     FROM generate_series(1, 12) AS m(month)
     LEFT JOIN (
       SELECT year_month, SUM(budgeted_amount) AS budgeted
       FROM monthly_budgets WHERE year_month LIKE $1
       GROUP BY year_month
     ) b ON b.year_month = $2 || '-' || LPAD(m.month::text, 2, '0')
     LEFT JOIN (
       SELECT TO_CHAR(date, 'YYYY-MM') AS ym, SUM(amount) AS spent
       FROM expenses WHERE EXTRACT(YEAR FROM date) = $3
       GROUP BY ym
     ) e ON e.ym = $2 || '-' || LPAD(m.month::text, 2, '0')
     LEFT JOIN (
       SELECT year_month, SUM(actual_amount) AS income
       FROM monthly_income WHERE year_month LIKE $1
       GROUP BY year_month
     ) i ON i.year_month = $2 || '-' || LPAD(m.month::text, 2, '0')
     LEFT JOIN (
       SELECT TO_CHAR(date, 'YYYY-MM') AS ym, SUM(amount) AS sales
       FROM sales WHERE EXTRACT(YEAR FROM date) = $3
       GROUP BY ym
     ) s ON s.ym = $2 || '-' || LPAD(m.month::text, 2, '0')
     ORDER BY m.month`,
    [monthPattern, yearStr, year]
  );

  const months: YearlyMonthRow[] = monthlyRes.rows.map((r) => ({
    month: `${yearStr}-${String(r.month).padStart(2, "0")}`,
    budgeted: Number(r.budgeted),
    spent: Number(r.spent),
    income: Number(r.income),
    sales: Number(r.sales),
  }));

  // Category totals for the year
  const catRes = await pool.query(
    `SELECT bc.name AS category_name, COALESCE(SUM(e.amount), 0) AS spent
     FROM budget_categories bc
     LEFT JOIN expenses e ON e.category_id = bc.id AND EXTRACT(YEAR FROM e.date) = $1
     GROUP BY bc.name
     HAVING COALESCE(SUM(e.amount), 0) > 0
     ORDER BY spent DESC`,
    [year]
  );

  return {
    year,
    months,
    total_budgeted: months.reduce((s, m) => s + m.budgeted, 0),
    total_spent: months.reduce((s, m) => s + m.spent, 0),
    total_income: months.reduce((s, m) => s + m.income, 0),
    total_sales: months.reduce((s, m) => s + m.sales, 0),
    category_totals: catRes.rows.map((r) => ({
      category_name: r.category_name,
      spent: Number(r.spent),
    })),
  };
}

export async function getAvailableYears(): Promise<number[]> {
  const res = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS year FROM expenses
     UNION
     SELECT DISTINCT SPLIT_PART(year_month, '-', 1)::int FROM monthly_budgets
     UNION
     SELECT DISTINCT SPLIT_PART(year_month, '-', 1)::int FROM monthly_income
     ORDER BY year DESC`
  );
  const years = res.rows.map((r) => r.year);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  return years;
}
