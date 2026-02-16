"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import SpendingPieChart from "./SpendingPieChart";

interface YearlyMonthRow {
  month: string;
  budgeted: number;
  spent: number;
  income: number;
  sales: number;
}

interface YearlySummaryData {
  year: number;
  months: YearlyMonthRow[];
  total_budgeted: number;
  total_spent: number;
  total_income: number;
  total_sales: number;
  category_totals: { category_name: string; spent: number }[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function YearlySummary() {
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<YearlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budget/yearly")
      .then((r) => r.json())
      .then((d) => {
        if (d.years) setYears(d.years);
      })
      .catch(() => {});
  }, []);

  const fetchYear = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/yearly?year=${selectedYear}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchYear();
  }, [fetchYear]);

  const currentMonth = new Date().getMonth(); // 0-based
  const isCurrentYear = selectedYear === new Date().getFullYear();

  // Only show months up to current for current year
  const displayMonths = data
    ? isCurrentYear
      ? data.months.slice(0, currentMonth + 1)
      : data.months
    : [];

  const ytdSpent = displayMonths.reduce((s, m) => s + m.spent, 0);
  const ytdBudgeted = displayMonths.reduce((s, m) => s + m.budgeted, 0);
  const ytdIncome = displayMonths.reduce((s, m) => s + m.income, 0);
  const ytdSales = displayMonths.reduce((s, m) => s + m.sales, 0);
  const ytdNet = ytdIncome + ytdSales - ytdSpent;

  const chartData = displayMonths.map((m, i) => ({
    name: MONTH_LABELS[i],
    Budgeted: m.budgeted,
    Spent: m.spent,
    Income: m.income + m.sales,
  }));

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              y === selectedYear
                ? "bg-[var(--interactive)] text-white"
                : "border border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">
          Loading yearly data...
        </div>
      ) : !data ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">
          No data available
        </div>
      ) : (
        <>
          {/* YTD Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-3 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {isCurrentYear ? "YTD" : "Total"} Spent
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(ytdSpent)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-3 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {isCurrentYear ? "YTD" : "Total"} Budgeted
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(ytdBudgeted)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-3 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {isCurrentYear ? "YTD" : "Total"} Income
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(ytdIncome + ytdSales)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-3 text-center">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Net
              </p>
              <p
                className={`mt-1 text-lg font-bold ${
                  ytdNet >= 0
                    ? "text-[var(--success-text)]"
                    : "text-[var(--error-text)]"
                }`}
              >
                {formatCurrency(ytdNet)}
              </p>
            </div>
          </div>

          {/* Monthly trend chart */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
              <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Monthly Trend — {selectedYear}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border-light)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Income" fill="var(--accent-emerald)" />
                  <Bar dataKey="Budgeted" fill="var(--accent-teal)" />
                  <Bar dataKey="Spent" fill="var(--interactive)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Yearly category breakdown pie */}
          {data.category_totals.length > 0 && (
            <SpendingPieChart
              data={data.category_totals.map((c) => ({
                category: c.category_name,
                amount: c.spent,
              }))}
            />
          )}

          {/* Monthly breakdown table */}
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
              Month-by-Month
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Month</th>
                    <th className="py-2 text-right font-medium text-[var(--text-secondary)]">Budgeted</th>
                    <th className="py-2 text-right font-medium text-[var(--text-secondary)]">Spent</th>
                    <th className="py-2 text-right font-medium text-[var(--text-secondary)]">Income</th>
                    <th className="py-2 text-right font-medium text-[var(--text-secondary)]">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMonths.map((m, i) => {
                    const mNet = m.income + m.sales - m.spent;
                    return (
                      <tr
                        key={m.month}
                        className="border-b border-[var(--border-light)] last:border-0"
                      >
                        <td className="py-2 text-[var(--text-primary)]">
                          {MONTH_LABELS[i]}
                        </td>
                        <td className="py-2 text-right text-[var(--text-primary)]">
                          {formatCurrency(m.budgeted)}
                        </td>
                        <td
                          className={`py-2 text-right ${
                            m.spent > m.budgeted
                              ? "text-[var(--error-text)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {formatCurrency(m.spent)}
                        </td>
                        <td className="py-2 text-right text-[var(--text-primary)]">
                          {formatCurrency(m.income + m.sales)}
                        </td>
                        <td
                          className={`py-2 text-right font-medium ${
                            mNet >= 0
                              ? "text-[var(--success-text)]"
                              : "text-[var(--error-text)]"
                          }`}
                        >
                          {formatCurrency(mNet)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[var(--border)] font-semibold">
                    <td className="py-2 text-[var(--text-primary)]">Total</td>
                    <td className="py-2 text-right text-[var(--text-primary)]">
                      {formatCurrency(ytdBudgeted)}
                    </td>
                    <td className="py-2 text-right text-[var(--text-primary)]">
                      {formatCurrency(ytdSpent)}
                    </td>
                    <td className="py-2 text-right text-[var(--text-primary)]">
                      {formatCurrency(ytdIncome + ytdSales)}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        ytdNet >= 0
                          ? "text-[var(--success-text)]"
                          : "text-[var(--error-text)]"
                      }`}
                    >
                      {formatCurrency(ytdNet)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
