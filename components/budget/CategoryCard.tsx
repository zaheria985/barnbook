"use client";

import { useState } from "react";
import type { CategoryOverview } from "@/lib/queries/budget-overview";

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
  onBudgetEdit,
}: {
  category: CategoryOverview;
  onBudgetEdit?: (categoryId: string, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(category.budgeted));

  const hasSubItems = category.sub_items.length > 0;

  function handleSave() {
    onBudgetEdit?.(category.category_id, Number(editValue) || 0);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => hasSubItems && setExpanded(!expanded)}
          className="flex items-center gap-2 text-left"
          disabled={!hasSubItems}
        >
          <span className="font-semibold text-[var(--text-primary)]">
            {category.category_name}
          </span>
          {hasSubItems && (
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
          )}
        </button>

        <div className="text-right">
          {editing ? (
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

      <ProgressBar spent={category.spent} budgeted={category.budgeted} />

      {expanded && hasSubItems && (
        <div className="mt-4 space-y-2 border-t border-[var(--border-light)] pt-3">
          {category.sub_items.map((sub) => (
            <div
              key={sub.sub_item_id}
              className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text-secondary)]">
                {sub.sub_item_label}
              </span>
              <div className="text-right">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
