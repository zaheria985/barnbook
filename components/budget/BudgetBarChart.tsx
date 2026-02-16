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

interface BarData {
  category: string;
  budgeted: number;
  actual: number;
  overBudget: boolean;
}

export default function BudgetBarChart({
  data,
}: {
  data: { category: string; budgeted: number; actual: number }[];
}) {
  const chartData: BarData[] = data.map((d) => ({
    category: d.category,
    budgeted: d.budgeted,
    actual: d.actual,
    overBudget: d.actual > d.budgeted,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        No budget data for this month
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Budget vs Actual
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis
            dataKey="category"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v) => `$${v}`}
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
          <Bar dataKey="budgeted" name="Budgeted" fill="#6d5acd" />
          <Bar dataKey="actual" name="Actual" fill="#2d9e8f">
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.overBudget ? "#c44569" : "#2d9e8f"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
