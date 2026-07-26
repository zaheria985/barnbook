"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { seriesColor } from "@/lib/chart-colors";

interface PieData {
  name: string;
  value: number;
  color: string;
}

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
      color: seriesColor(i),
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        No spending data for this month
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
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
            label={({ name, percent, x, y }) => (
              <text
                x={x}
                y={y}
                style={{ fill: "var(--text-secondary)", fontSize: 12 }}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {`${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              </text>
            )}
            outerRadius={100}
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
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              color: "var(--text-primary)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
