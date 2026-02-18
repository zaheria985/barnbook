"use client";

import { useState, useEffect, useCallback } from "react";
import type { BudgetCategory } from "@/lib/queries/budget-categories";
import type { BudgetDefault } from "@/lib/queries/budget-defaults";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** Build a unique key for pending edits: categoryId or categoryId:subItemId */
function editKey(categoryId: string, subItemId: string | null): string {
  return subItemId ? `${categoryId}:${subItemId}` : categoryId;
}

export default function BudgetDefaultsPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [defaults, setDefaults] = useState<BudgetDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, defRes] = await Promise.all([
        fetch("/api/budget/categories"),
        fetch("/api/budget/defaults"),
      ]);
      if (!catRes.ok || !defRes.ok) throw new Error("Failed to fetch");
      const [catData, defData] = await Promise.all([
        catRes.json(),
        defRes.json(),
      ]);
      setCategories(catData);
      setDefaults(defData);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleCategory(catId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function getDefaultAmount(
    categoryId: string,
    subItemId: string | null
  ): number {
    const d = defaults.find(
      (def) =>
        def.category_id === categoryId &&
        (subItemId ? def.sub_item_id === subItemId : def.sub_item_id === null)
    );
    return d ? Number(d.budgeted_amount) : 0;
  }

  function getEditValue(
    categoryId: string,
    subItemId: string | null
  ): string {
    const key = editKey(categoryId, subItemId);
    if (pendingEdits[key] !== undefined) return pendingEdits[key];
    return String(getDefaultAmount(categoryId, subItemId));
  }

  function setEditField(
    categoryId: string,
    subItemId: string | null,
    value: string
  ) {
    const key = editKey(categoryId, subItemId);
    setPendingEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(categoryId: string, subItemId: string | null) {
    const key = editKey(categoryId, subItemId);
    const val = getEditValue(categoryId, subItemId);
    const amount = Number(val) || 0;
    const current = getDefaultAmount(categoryId, subItemId);

    if (amount === current) {
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    try {
      const res = await fetch("/api/budget/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, subItemId, amount }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchData();
    } catch {
      setError("Failed to save default");
    }
  }

  const total = categories.reduce((sum, cat) => {
    if (cat.sub_items.length > 0) {
      return (
        sum +
        cat.sub_items.reduce(
          (s, sub) => s + getDefaultAmount(cat.id, sub.id),
          0
        )
      );
    }
    return sum + getDefaultAmount(cat.id, null);
  }, 0);

  function renderAmountInput(categoryId: string, subItemId: string | null) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
          $
        </span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={getEditValue(categoryId, subItemId)}
          onChange={(e) => setEditField(categoryId, subItemId, e.target.value)}
          onBlur={() => handleSave(categoryId, subItemId)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-28 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-7 pr-3 text-right text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Budget Defaults
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Standard budget amounts applied to each new month
        </p>
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

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Loading...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">
                Total
              </span>
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Categories */}
          {categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat.id);
            const hasSubItems = cat.sub_items.length > 0;
            const catTotal = hasSubItems
              ? cat.sub_items.reduce(
                  (s, sub) => s + getDefaultAmount(cat.id, sub.id),
                  0
                )
              : getDefaultAmount(cat.id, null);

            return (
              <div
                key={cat.id}
                className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <div className="flex items-center gap-2">
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
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                    <span className="font-medium text-[var(--text-primary)]">
                      {cat.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    {formatCurrency(catTotal)}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--border-light)] px-4 py-3 space-y-3">
                    {hasSubItems ? (
                      cat.sub_items.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2"
                        >
                          <span className="text-sm text-[var(--text-secondary)]">
                            {sub.label}
                          </span>
                          {renderAmountInput(cat.id, sub.id)}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-sm text-[var(--text-secondary)]">
                          {cat.name}
                        </span>
                        {renderAmountInput(cat.id, null)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
