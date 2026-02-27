import pool from "@/lib/db";
import { getMonthlyBudgets } from "./monthly-budgets";
import { getExpenses } from "./expenses";
import { getMonthlyIncome } from "./income";
import { getSales } from "./sales";

export async function getSavingsBalance(): Promise<number> {
  const res = await pool.query(
    `SELECT balance FROM horse_savings_account LIMIT 1`
  );
  return Number(res.rows[0]?.balance || 0);
}

export interface MonthlyBalance {
  id: string;
  year_month: string;
  total_budgeted: number;
  total_spent: number;
  total_income_actual: number;
  total_sales: number;
  previous_deficit: number;
  net_result: number;
  savings_contribution: number;
  savings_withdrawal: number;
  deficit_carryover: number;
  is_closed: boolean;
  created_at: string;
}

export interface MonthEndCalculation {
  year_month: string;
  total_budgeted: number;
  total_spent: number;
  total_income_actual: number;
  total_sales: number;
  previous_deficit: number;
  net_result: number;
  savings_contribution: number;
  savings_withdrawal: number;
  deficit_carryover: number;
}

export async function calculateMonthEndBalance(
  yearMonth: string
): Promise<MonthEndCalculation> {
  const [budgets, expenses, income, sales] = await Promise.all([
    getMonthlyBudgets(yearMonth),
    getExpenses(yearMonth),
    getMonthlyIncome(yearMonth),
    getSales(yearMonth),
  ]);

  const total_budgeted = budgets.reduce(
    (s, b) => s + Number(b.budgeted_amount),
    0
  );
  const total_spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const total_income_actual = income.reduce(
    (s, i) => s + Number(i.actual_amount),
    0
  );
  const total_sales = sales.reduce((s, sale) => s + Number(sale.amount), 0);

  const net = total_income_actual + total_sales - total_spent;

  return {
    year_month: yearMonth,
    total_budgeted,
    total_spent,
    total_income_actual,
    total_sales,
    previous_deficit: 0,
    net_result: net,
    savings_contribution: Math.max(net, 0),
    savings_withdrawal: Math.max(-net, 0),
    deficit_carryover: 0,
  };
}

export async function getMonthlyBalance(
  yearMonth: string
): Promise<MonthlyBalance | null> {
  const res = await pool.query(
    `SELECT * FROM monthly_balances WHERE year_month = $1`,
    [yearMonth]
  );
  return res.rows[0] || null;
}

export async function isMonthClosed(yearMonth: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT is_closed FROM monthly_balances WHERE year_month = $1`,
    [yearMonth]
  );
  return res.rows[0]?.is_closed || false;
}

export async function closeMonth(
  yearMonth: string
): Promise<{ balance: MonthlyBalance; savingsBalance: number }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, is_closed FROM monthly_balances WHERE year_month = $1`,
      [yearMonth]
    );

    if (existing.rows[0]?.is_closed) {
      await client.query("ROLLBACK");
      throw new Error("Month is already closed");
    }

    const calc = await calculateMonthEndBalance(yearMonth);

    const balanceRes = await client.query(
      `INSERT INTO monthly_balances (
        year_month, total_budgeted, total_spent, total_income_actual, total_sales,
        previous_deficit, net_result, savings_contribution, savings_withdrawal,
        deficit_carryover, is_closed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT (year_month) DO UPDATE SET
        total_budgeted = EXCLUDED.total_budgeted,
        total_spent = EXCLUDED.total_spent,
        total_income_actual = EXCLUDED.total_income_actual,
        total_sales = EXCLUDED.total_sales,
        previous_deficit = EXCLUDED.previous_deficit,
        net_result = EXCLUDED.net_result,
        savings_contribution = EXCLUDED.savings_contribution,
        savings_withdrawal = EXCLUDED.savings_withdrawal,
        deficit_carryover = EXCLUDED.deficit_carryover,
        is_closed = true
      RETURNING *`,
      [
        calc.year_month,
        calc.total_budgeted,
        calc.total_spent,
        calc.total_income_actual,
        calc.total_sales,
        calc.previous_deficit,
        calc.net_result,
        calc.savings_contribution,
        calc.savings_withdrawal,
        calc.deficit_carryover,
      ]
    );

    if (calc.net_result !== 0) {
      await client.query(
        `UPDATE horse_savings_account SET balance = balance + $1, updated_at = now()`,
        [calc.net_result]
      );
    }

    const savingsRes = await client.query(
      `SELECT balance FROM horse_savings_account LIMIT 1`
    );

    await client.query("COMMIT");

    return {
      balance: balanceRes.rows[0],
      savingsBalance: Number(savingsRes.rows[0]?.balance || 0),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reopenMonth(
  yearMonth: string
): Promise<{ balance: MonthlyBalance; savingsBalance: number }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM monthly_balances WHERE year_month = $1`,
      [yearMonth]
    );

    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("No closed month record found");
    }

    if (!existing.rows[0].is_closed) {
      await client.query("ROLLBACK");
      throw new Error("Month is not closed");
    }

    const netResult = Number(existing.rows[0].net_result);

    if (netResult !== 0) {
      await client.query(
        `UPDATE horse_savings_account SET balance = balance - $1, updated_at = now()`,
        [netResult]
      );
    }

    const balanceRes = await client.query(
      `UPDATE monthly_balances SET is_closed = false WHERE year_month = $1 RETURNING *`,
      [yearMonth]
    );

    const savingsRes = await client.query(
      `SELECT balance FROM horse_savings_account LIMIT 1`
    );

    await client.query("COMMIT");

    return {
      balance: balanceRes.rows[0],
      savingsBalance: Number(savingsRes.rows[0]?.balance || 0),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
