"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthSelector from "@/components/budget/MonthSelector";
import SavingsCard from "@/components/budget/SavingsCard";
import Modal from "@/components/ui/Modal";
import CategoryCard from "@/components/budget/CategoryCard";
import SpendingPieChart from "@/components/budget/SpendingPieChart";
import BudgetBarChart from "@/components/budget/BudgetBarChart";
import YearlySummary from "@/components/budget/YearlySummary";
import type { CategoryOverview } from "@/lib/queries/budget-overview";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

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
  has_defaults: boolean;
  total_income_projected: number;
  total_income_actual: number;
}

export default function BudgetPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [data, setData] = useState<OverviewData | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showYearly, setShowYearly] = useState(false);
  const [showApplyDefaults, setShowApplyDefaults] = useState(false);
  const [applying, setApplying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, catRes] = await Promise.all([
        fetch(`/api/budget/overview?month=${month}`),
        fetch("/api/budget/categories"),
      ]);
      if (!overviewRes.ok) throw new Error("Failed to fetch");
      const json = await overviewRes.json();
      setData(json);
      if (catRes.ok) {
        setBudgetCategories(await catRes.json());
      }
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

  async function handleApplyDefaults(mode: "fill" | "overwrite") {
    setApplying(true);
    try {
      const res = await fetch("/api/budget/monthly/apply-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, mode }),
      });
      if (!res.ok) throw new Error("Failed to apply defaults");
      setShowApplyDefaults(false);
      await fetchData();
    } catch {
      setError("Failed to apply defaults");
    } finally {
      setApplying(false);
    }
  }

  const monthHasBudgets = data ? data.total_budgeted > 0 : false;

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
  const netWithIncome = data.total_income_actual - data.total_spent;

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

      {/* Income summary */}
      {(data.total_income_projected > 0 || data.total_income_actual > 0) && (
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Income</span>
            <Link
              href="/budget/income"
              className="text-xs font-medium text-[var(--interactive)] hover:underline"
            >
              Manage Income
            </Link>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Projected</span>
            <span className="font-medium text-[var(--text-primary)]">
              {formatCurrency(data.total_income_projected)}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Actual</span>
            <span className="font-medium text-[var(--text-primary)]">
              {formatCurrency(data.total_income_actual)}
            </span>
          </div>
          <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-base font-bold">
            <span className="text-[var(--text-primary)]">Net (Income − Spent)</span>
            <span className={netWithIncome >= 0 ? "text-[var(--success-text)]" : "text-[var(--error-text)]"}>
              {formatCurrency(netWithIncome)}
            </span>
          </div>
        </div>
      )}

      <Link
        href="/budget/close"
        className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
      >
        Close Month <span aria-hidden="true">&rarr;</span>
      </Link>

      <div className="mb-6">
        <SavingsCard balance={data.savings_balance} />
      </div>


      {data.has_defaults && (
        <div className="mb-6">
          <button
            onClick={() => {
              if (monthHasBudgets) {
                setShowApplyDefaults(true);
              } else {
                handleApplyDefaults("fill");
              }
            }}
            disabled={applying}
            className="w-full rounded-xl border border-dashed border-[var(--interactive)] py-3 text-sm font-medium text-[var(--interactive)] hover:bg-[var(--interactive-muted)] disabled:opacity-50 transition-colors"
          >
            {applying ? "Applying..." : "Apply Budget Defaults"}
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Categories
        </h2>
        <Link
          href={`/budget/expenses?month=${month}`}
          className="text-xs font-medium text-[var(--interactive)] hover:underline"
        >
          View All Expenses
        </Link>
      </div>
      <div className="space-y-4">
        {data.categories.map((cat) => (
          <CategoryCard
            key={cat.category_id}
            category={cat}
            month={month}
            categories={budgetCategories}
            onBudgetEdit={handleBudgetEdit}
            onExpenseChanged={fetchData}
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

      <Modal
        open={showApplyDefaults}
        onClose={() => setShowApplyDefaults(false)}
        title="Apply Budget Defaults"
      >
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          This month already has budgets set. How would you like to apply defaults?
        </p>
        <div className="space-y-2">
          <button
            onClick={() => handleApplyDefaults("fill")}
            disabled={applying}
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-left hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <span className="font-medium text-[var(--text-primary)]">Fill Gaps</span>
            <p className="text-xs text-[var(--text-muted)]">Only add defaults where no budget is set yet</p>
          </button>
          <button
            onClick={() => handleApplyDefaults("overwrite")}
            disabled={applying}
            className="w-full rounded-lg border border-[var(--error-border)] px-4 py-3 text-left hover:bg-[var(--error-bg)] disabled:opacity-50"
          >
            <span className="font-medium text-[var(--error-text)]">Overwrite All</span>
            <p className="text-xs text-[var(--text-muted)]">Replace all budgets with defaults</p>
          </button>
          <button
            onClick={() => setShowApplyDefaults(false)}
            disabled={applying}
            className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Link
        href="/budget/entry"
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--interactive)] text-white shadow-lg hover:bg-[var(--interactive-hover)] md:bottom-8"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      </Link>
    </div>
  );
}
