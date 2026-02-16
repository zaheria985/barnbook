"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthSelector from "@/components/budget/MonthSelector";
import SavingsCard from "@/components/budget/SavingsCard";
import DeficitBanner from "@/components/budget/DeficitBanner";
import CategoryCard from "@/components/budget/CategoryCard";
import SpendingPieChart from "@/components/budget/SpendingPieChart";
import BudgetBarChart from "@/components/budget/BudgetBarChart";
import YearlySummary from "@/components/budget/YearlySummary";
import type { CategoryOverview } from "@/lib/queries/budget-overview";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

interface OverviewData {
  categories: CategoryOverview[];
  total_budgeted: number;
  total_spent: number;
  savings_balance: number;
  previous_month: { deficit_carryover: number; is_closed: boolean } | null;
}

export default function BudgetPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showYearly, setShowYearly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/overview?month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load budget overview");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleBudgetEdit(categoryId: string, amount: number) {
    try {
      const res = await fetch("/api/budget/monthly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: month,
          categoryId,
          amount,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchData();
    } catch {
      setError("Failed to update budget");
    }
  }

  const prevMonthLabel = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]) - 2,
    1
  ).toLocaleDateString("en-US", { month: "long" });

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-[var(--error-text)]">{error || "Error"}</div>
    );
  }

  const net = data.total_budgeted - data.total_spent;

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Budget</h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Charts at the top */}
      <div className="mb-6 space-y-4">
        <SpendingPieChart
          data={data.categories.map((c) => ({
            category: c.category_name,
            amount: c.spent,
          }))}
        />
        <BudgetBarChart
          data={data.categories.map((c) => ({
            category: c.category_name,
            budgeted: c.budgeted,
            actual: c.spent,
          }))}
        />
      </div>

      {/* Summary bar */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Total Budgeted</span>
          <span className="font-medium text-[var(--text-primary)]">
            {formatCurrency(data.total_budgeted)}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Total Spent</span>
          <span
            className={`font-medium ${
              data.total_spent > data.total_budgeted
                ? "text-[var(--error-text)]"
                : "text-[var(--text-primary)]"
            }`}
          >
            {formatCurrency(data.total_spent)}
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-base font-bold">
          <span className="text-[var(--text-primary)]">Net</span>
          <span className={net >= 0 ? "text-[var(--success-text)]" : "text-[var(--error-text)]"}>
            {formatCurrency(net)}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <SavingsCard balance={data.savings_balance} />
      </div>

      {data.previous_month && data.previous_month.deficit_carryover > 0 && (
        <div className="mb-6">
          <DeficitBanner
            amount={data.previous_month.deficit_carryover}
            monthLabel={prevMonthLabel}
          />
        </div>
      )}

      <div className="space-y-4">
        {data.categories.map((cat) => (
          <CategoryCard
            key={cat.category_id}
            category={cat}
            onBudgetEdit={handleBudgetEdit}
          />
        ))}
      </div>

      {/* Year Overview toggle */}
      <div className="mt-8">
        <button
          onClick={() => setShowYearly(!showYearly)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3 text-left font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <span>Year Overview</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${showYearly ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {showYearly && (
          <div className="mt-4">
            <YearlySummary />
          </div>
        )}
      </div>

      <Link
        href="/budget/entry"
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--interactive)] text-white shadow-lg hover:bg-[var(--interactive-hover)] md:bottom-8"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      </Link>
    </div>
  );
}
