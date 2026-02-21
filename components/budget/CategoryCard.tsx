"use client";

import { useState, useCallback } from "react";
import type { CategoryOverview } from "@/lib/queries/budget-overview";
import type { Expense } from "@/lib/queries/expenses";
import type { BudgetCategory } from "@/lib/queries/budget-categories";
import ExpenseTable from "./ExpenseTable";
import Sparkline from "./Sparkline";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function ProgressBar({ spent, budgeted }: { spent: number; budgeted: number }) {
  const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const clamped = Math.min(percentage, 100);

  let colorClass = "bg-[var(--success-solid)]";
  if (percentage > 100) colorClass = "bg-[var(--error-text)]";
  else if (percentage >= 80) colorClass = "bg-[var(--warning-solid)]";

  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {percentage.toFixed(0)}% of budget
      </p>
    </div>
  );
}

export default function CategoryCard({
  category,
  month,
  categories,
  onBudgetEdit,
  onExpenseChanged,
  trendData,
  subItemTrends,
}: {
  category: CategoryOverview;
  month?: string;
  categories?: BudgetCategory[];
  onBudgetEdit?: (categoryId: string, subItemId: string | null, amount: number) => void;
  onExpenseChanged?: () => void;
  trendData?: number[];
  subItemTrends?: Record<string, number[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(category.budgeted));
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [subEditValue, setSubEditValue] = useState("");

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (!month) return;
    setLoadingExpenses(true);
    try {
      const res = await fetch(
        `/api/expenses?month=${month}&category=${category.category_id}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setExpenses(data);
    } catch {
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  }, [month, category.category_id]);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && expenses === null && month) {
      fetchExpenses();
    }
  }

  function handleSave() {
    onBudgetEdit?.(category.category_id, null, Number(editValue) || 0);
    setEditing(false);
  }

  function handleSubItemSave(subItemId: string) {
    onBudgetEdit?.(category.category_id, subItemId, Number(subEditValue) || 0);
    setEditingSubItemId(null);
  }

  function handleExpenseChanged() {
    fetchExpenses();
    onExpenseChanged?.();
  }

  const hasSubItems = category.sub_items.length > 0;

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 text-left"
        >
          <span className="font-semibold text-[var(--text-primary)]">
            {category.category_name}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[var(--text-muted)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div className="text-right">
          {!hasSubItems && editing ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">$</span>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                className="w-20 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-right text-sm"
              />
              <button
                onClick={handleSave}
                className="text-xs text-[var(--interactive)] hover:underline"
              >
                Save
              </button>
            </div>
          ) : hasSubItems ? (
            <div className="text-right">
              <p className="text-sm text-[var(--text-muted)]">
                Budget: {formatCurrency(category.budgeted)}
              </p>
              <p
                className={`text-sm font-medium ${
                  category.spent > category.budgeted
                    ? "text-[var(--error-text)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                Spent: {formatCurrency(category.spent)}
              </p>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditing(true);
                setEditValue(String(category.budgeted));
              }}
              className="text-right"
            >
              <p className="text-sm text-[var(--text-muted)]">
                Budget: {formatCurrency(category.budgeted)}
              </p>
              <p
                className={`text-sm font-medium ${
                  category.spent > category.budgeted
                    ? "text-[var(--error-text)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                Spent: {formatCurrency(category.spent)}
              </p>
            </button>
          )}
        </div>
      </div>

      {trendData && trendData.length > 0 && (
        <div className="mt-2 flex items-center justify-end">
          <Sparkline data={trendData} />
        </div>
      )}

      <ProgressBar spent={category.spent} budgeted={category.budgeted} />

      {expanded && (
        <div className="mt-4 border-t border-[var(--border-light)] pt-3">
          {/* Sub-item aggregates */}
          {hasSubItems && (
            <div className="space-y-2 mb-3">
              {category.sub_items.map((sub) => (
                <div
                  key={sub.sub_item_id}
                  className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2"
                >
                  <span className="text-sm text-[var(--text-secondary)]">
                    {sub.sub_item_label}
                  </span>
                  <div className="flex items-center gap-2">
                    {sub.sub_item_id && subItemTrends?.[sub.sub_item_id] && (
                      <Sparkline
                        data={subItemTrends[sub.sub_item_id]}
                        width={60}
                        height={22}
                      />
                    )}
                    {editingSubItemId === sub.sub_item_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">$</span>
                        <input
                          type="number"
                          value={subEditValue}
                          onChange={(e) => setSubEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSubItemSave(sub.sub_item_id!);
                            if (e.key === "Escape") setEditingSubItemId(null);
                          }}
                          autoFocus
                          className="w-20 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-right text-sm"
                        />
                        <button
                          onClick={() => handleSubItemSave(sub.sub_item_id!)}
                          className="text-xs text-[var(--interactive)] hover:underline"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingSubItemId(sub.sub_item_id);
                          setSubEditValue(String(sub.budgeted));
                        }}
                        className="text-right"
                      >
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatCurrency(sub.budgeted)}
                        </p>
                        <p
                          className={`text-sm ${
                            sub.spent > sub.budgeted
                              ? "text-[var(--error-text)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {formatCurrency(sub.spent)}
                        </p>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expenses section */}
          {month && categories && (
            <>
              {hasSubItems && (
                <div className="mb-3 border-t border-[var(--border-light)]" />
              )}
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Expenses
              </p>
              {loadingExpenses ? (
                <p className="py-2 text-center text-sm text-[var(--text-muted)]">
                  Loading...
                </p>
              ) : expenses && expenses.length > 0 ? (
                <ExpenseTable
                  expenses={expenses}
                  categories={categories}
                  onChanged={handleExpenseChanged}
                />
              ) : (
                <p className="py-2 text-center text-sm text-[var(--text-muted)]">
                  No expenses recorded
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
