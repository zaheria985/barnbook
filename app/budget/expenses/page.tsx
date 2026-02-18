"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthSelector from "@/components/budget/MonthSelector";
import ExpenseTable from "@/components/budget/ExpenseTable";
import type { Expense } from "@/lib/queries/expenses";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("month");
      if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        fetch(`/api/expenses?month=${month}`),
        fetch("/api/budget/categories"),
      ]);

      if (!expRes.ok || !catRes.ok) throw new Error("Failed to fetch");

      const [expData, catData] = await Promise.all([
        expRes.json(),
        catRes.json(),
      ]);

      setExpenses(expData);
      setCategories(catData);
    } catch {
      setError("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Expenses
        </h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Total bar */}
      <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          </span>
          <span className="text-base font-bold text-[var(--text-primary)]">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        {loading ? (
          <div className="py-8 text-center text-[var(--text-muted)]">
            Loading...
          </div>
        ) : (
          <ExpenseTable
            expenses={expenses}
            categories={categories}
            showCategory={true}
            onChanged={fetchData}
          />
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/budget"
          className="text-sm text-[var(--interactive)] hover:underline"
        >
          &larr; Back to Budget
        </Link>
      </div>
    </div>
  );
}
