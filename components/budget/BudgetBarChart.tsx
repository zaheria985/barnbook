"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART } from "@/lib/chart-colors";

interface BarData {
  category: string;
  budgeted: number;
  actual: number;
  overBudget: boolean;
}

/** Vertical space per category row; keeps bar thickness steady as rows vary. */
const ROW_HEIGHT = 44;

export default function BudgetBarChart({
  data,
}: {
  data: { category: string; budgeted: number; actual: number }[];
}) {
  // Categories with no budget and no spending are noise here; the category
  // list below the chart still shows every one of them.
  const chartData: BarData[] = data
    .filter((d) => d.budgeted > 0 || d.actual > 0)
    .map((d) => ({
      category: d.category,
      budgeted: d.budgeted,
      actual: d.actual,
      overBudget: d.actual > d.budgeted,
    }));
  const hiddenCount = data.length - chartData.length;

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        No budget data for this month
      </div>
    );
  }

  const height = Math.max(160, chartData.length * ROW_HEIGHT + 60);

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Budget vs Actual
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={120}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            interval={0}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              color: "var(--text-primary)",
            }}
          />
          <Legend />
          <Bar dataKey="budgeted" name="Budgeted" fill={CHART.budgeted} />
          <Bar dataKey="actual" name="Actual" fill={CHART.actual}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.overBudget ? CHART.over : CHART.actual}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hiddenCount > 0 && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {hiddenCount} categor{hiddenCount === 1 ? "y" : "ies"} with no budget
          or spending hidden
        </p>
      )}
    </div>
  );
}
