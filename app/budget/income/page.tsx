"use client";

import { useState, useEffect, useCallback } from "react";
import type { IncomeCategory, MonthlyIncome } from "@/lib/queries/income";
import type { Sale } from "@/lib/queries/sales";
import IncomeCategoryManager from "@/components/settings/IncomeCategoryManager";
import Modal from "@/components/ui/Modal";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function MonthSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (m: string) => void;
}) {
  const [year, month] = value.split("-").map(Number);

  function prev() {
    const d = new Date(year, month - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function next() {
    const d = new Date(year, month, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const label = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-center justify-center gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-2">
      <button
        onClick={prev}
        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span className="min-w-[140px] text-center font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <button
        onClick={next}
        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  );
}

/** Build a unique key for pending edits: categoryId or categoryId:subItemId */
function editKey(categoryId: string, subItemId: string | null): string {
  return subItemId ? `${categoryId}:${subItemId}` : categoryId;
}

export default function IncomePage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<MonthlyIncome[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [pendingEdits, setPendingEdits] = useState<
    Record<string, { projected: string; actual: string }>
  >({});

  const [showAddSale, setShowAddSale] = useState(false);
  const [saleDescription, setSaleDescription] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriesRes, incomeRes, salesRes] = await Promise.all([
        fetch("/api/income/sources"),
        fetch(`/api/income/monthly?month=${month}`),
        fetch(`/api/sales?month=${month}`),
      ]);

      if (!categoriesRes.ok || !incomeRes.ok || !salesRes.ok) {
        throw new Error("Failed to fetch");
      }

      const [c, mi, sa] = await Promise.all([
        categoriesRes.json(),
        incomeRes.json(),
        salesRes.json(),
      ]);

      setCategories(c);
      setMonthlyIncome(mi);
      setSales(sa);
    } catch {
      setError("Failed to load income data");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleCategory(catId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }

  function getEditValues(categoryId: string, subItemId: string | null) {
    const key = editKey(categoryId, subItemId);
    if (pendingEdits[key]) return pendingEdits[key];
    const mi = monthlyIncome.find(
      (i) =>
        i.category_id === categoryId &&
        (subItemId ? i.sub_item_id === subItemId : i.sub_item_id === null)
    );
    return {
      projected: String(mi?.projected_amount || 0),
      actual: String(mi?.actual_amount || 0),
    };
  }

  function setEditField(
    categoryId: string,
    subItemId: string | null,
    field: "projected" | "actual",
    value: string
  ) {
    const key = editKey(categoryId, subItemId);
    const current = getEditValues(categoryId, subItemId);
    setPendingEdits((prev) => ({
      ...prev,
      [key]: { ...current, [field]: value },
    }));
  }

  async function handleSaveIncome(categoryId: string, subItemId: string | null) {
    const key = editKey(categoryId, subItemId);
    const vals = getEditValues(categoryId, subItemId);
    const projected = Number(vals.projected) || 0;
    const actual = Number(vals.actual) || 0;

    // Skip save if nothing changed
    const mi = monthlyIncome.find(
      (i) =>
        i.category_id === categoryId &&
        (subItemId ? i.sub_item_id === subItemId : i.sub_item_id === null)
    );
    if (
      projected === Number(mi?.projected_amount || 0) &&
      actual === Number(mi?.actual_amount || 0)
    ) {
      return;
    }

    try {
      const res = await fetch("/api/income/monthly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: month,
          categoryId,
          subItemId,
          projected,
          actual,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchData();
    } catch {
      setError("Failed to update income");
    }
  }

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: saleDescription,
          amount: Number(saleAmount),
          date: saleDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setShowAddSale(false);
      setSaleDescription("");
      setSaleAmount("");
      await fetchData();
    } catch {
      setError("Failed to add sale");
    }
  }

  async function handleDeleteSale(id: string, description: string) {
    if (!confirm(`Delete sale "${description}"?`)) return;
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchData();
    } catch {
      setError("Failed to delete sale");
    }
  }

  /** Get income rows for a specific category */
  function getCategoryIncome(categoryId: string): MonthlyIncome[] {
    return monthlyIncome.filter((i) => i.category_id === categoryId);
  }

  /** Calculate totals for a category (sum of all its monthly income rows) */
  function getCategoryTotals(categoryId: string) {
    const rows = getCategoryIncome(categoryId);
    return {
      projected: rows.reduce((s, i) => s + Number(i.projected_amount), 0),
      actual: rows.reduce((s, i) => s + Number(i.actual_amount), 0),
    };
  }

  const totalProjected = monthlyIncome.reduce((s, i) => s + Number(i.projected_amount), 0);
  const totalActual = monthlyIncome.reduce((s, i) => s + Number(i.actual_amount), 0);
  const totalSales = sales.reduce((s, sale) => s + Number(sale.amount), 0);

  function renderIncomeInputs(
    categoryId: string,
    subItemId: string | null,
    label: string
  ) {
    const vals = getEditValues(categoryId, subItemId);
    return (
      <div className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] p-3">
        <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Projected
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={vals.projected}
                onChange={(e) =>
                  setEditField(categoryId, subItemId, "projected", e.target.value)
                }
                onBlur={() => handleSaveIncome(categoryId, subItemId)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-7 pr-3 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Actual
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={vals.actual}
                onChange={(e) =>
                  setEditField(categoryId, subItemId, "actual", e.target.value)
                }
                onBlur={() => handleSaveIncome(categoryId, subItemId)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-7 pr-3 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Income Management
        </h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Income Categories
              </h2>
              <button
                onClick={() => setShowCategoryManager(true)}
                className="text-sm text-[var(--interactive)] hover:underline"
              >
                Manage Categories
              </button>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No income categories. Add one via Manage Categories.
              </p>
            ) : (
              <div className="space-y-4">
                {categories.map((cat) => {
                  const isCollapsed = collapsedCategories.has(cat.id);
                  const catTotals = getCategoryTotals(cat.id);
                  const hasSubItems = cat.sub_items.length > 0;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden"
                    >
                      {/* Category header */}
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
                            className={`text-[var(--text-muted)] transition-transform ${!isCollapsed ? "rotate-180" : ""}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                          <span className="font-medium text-[var(--text-primary)]">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-[var(--text-secondary)]">
                            Proj: {formatCurrency(catTotals.projected)}
                          </span>
                          <span className="text-[var(--text-primary)]">
                            Act: {formatCurrency(catTotals.actual)}
                          </span>
                        </div>
                      </button>

                      {/* Category body */}
                      {!isCollapsed && (
                        <div className="border-t border-[var(--border-light)] px-4 py-3 space-y-3">
                          {hasSubItems ? (
                            /* Render sub-item inputs */
                            cat.sub_items.map((sub) =>
                              renderIncomeInputs(cat.id, sub.id, sub.label)
                            )
                          ) : (
                            /* No sub-items: category-level input */
                            renderIncomeInputs(cat.id, null, cat.name)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-semibold">
                  <span className="text-[var(--text-primary)]">Total Income</span>
                  <div className="flex gap-6 text-sm">
                    <span className="text-[var(--text-secondary)]">
                      Projected: {formatCurrency(totalProjected)}
                    </span>
                    <span className="text-[var(--text-primary)]">
                      Actual: {formatCurrency(totalActual)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Sales
              </h2>
              <button
                onClick={() => setShowAddSale(true)}
                className="rounded-lg bg-[var(--interactive)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--interactive-hover)]"
              >
                + Add Sale
              </button>
            </div>

            {showAddSale && (
              <form onSubmit={handleAddSale} className="mb-4 rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={saleDescription}
                    onChange={(e) => setSaleDescription(e.target.value)}
                    placeholder="Description"
                    required
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    placeholder="Amount"
                    required
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                    className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={!saleDescription || !saleAmount}
                    className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
                  >
                    Save Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSale(false)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {sales.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No sales recorded this month.</p>
            ) : (
              <div className="space-y-2">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{sale.description}</p>
                      <p className="text-xs text-[var(--text-muted)]">{sale.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatCurrency(Number(sale.amount))}
                      </span>
                      <button
                        onClick={() => handleDeleteSale(sale.id, sale.description)}
                        className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                  <span className="text-[var(--text-primary)]">Total Sales</span>
                  <span className="text-[var(--text-primary)]">{formatCurrency(totalSales)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-[var(--text-primary)]">Total Income + Sales (Actual)</span>
              <span className="text-[var(--text-primary)]">{formatCurrency(totalActual + totalSales)}</span>
            </div>
          </div>
        </div>
      )}

      <Modal open={showCategoryManager} onClose={() => setShowCategoryManager(false)} title="Manage Income Categories">
        <IncomeCategoryManager />
      </Modal>
    </div>
  );
}
