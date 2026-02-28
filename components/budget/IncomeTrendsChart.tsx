"use client";

import { useState, useEffect } from "react";
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
import type { IncomeTrend } from "@/lib/queries/income";

interface ChartData {
  label: string;
  month: string;
  income: number;
  sales: number;
  total: number;
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function IncomeTrendsChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTrends() {
      try {
        const res = await fetch("/api/income/trends");
        if (!res.ok) throw new Error("Failed to fetch");
        const trends: IncomeTrend[] = await res.json();
        setData(
          trends.map((t) => ({
            label: formatMonthLabel(t.month),
            month: t.month,
            income: t.income,
            sales: t.sales,
            total: t.income + t.sales,
          }))
        );
      } catch {
        setError("Failed to load income trends");
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        Loading trends...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--error-text)]">
        {error}
      </div>
    );
  }

  const hasData = data.some((d) => d.total > 0);
  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-sm text-[var(--text-muted)]">
        No income data for the past 12 months
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
        Income Trends (12 Months)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(value: number | undefined) => [
              formatCurrency(Number(value ?? 0)),
              "",
            ]}
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              color: "var(--text-primary)",
            }}
          />
          <Legend />
          <Bar
            dataKey="income"
            name="Income"
            stackId="total"
            fill="#2d9e8f"
          />
          <Bar
            dataKey="sales"
            name="Sales"
            stackId="total"
            fill="#6d5acd"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
