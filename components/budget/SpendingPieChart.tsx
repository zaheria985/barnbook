"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface PieData {
  name: string;
  value: number;
  color: string;
}

const COLORS = [
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#b7e4c7",
  "#d8f3dc",
  "#1b4332",
  "#52796f",
  "#84a98c",
];

export default function SpendingPieChart({
  data,
}: {
  data: { category: string; amount: number }[];
}) {
  const chartData: PieData[] = data
    .filter((d) => d.amount > 0)
    .map((d, i) => ({
      name: d.category,
      value: d.amount,
      color: COLORS[i % COLORS.length],
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        No spending data for this month
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Spending by Category
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${((percent || 0) * 100).toFixed(0)}%`
            }
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              `$${Number(value).toFixed(2)} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              "Amount",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
