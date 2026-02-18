"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import BulkPasteEntry from "@/components/budget/BulkPasteEntry";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

interface RowData {
  id: string;
  date: string;
  category_id: string;
  sub_item_id: string;
  vendor: string;
  amount: string;
  notes: string;
  errors?: string[];
}

export default function BulkEntryPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState<"bulk" | "quick">("bulk");

  useEffect(() => {
    fetch("/api/budget/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load categories");
        setLoading(false);
      });
  }, []);

  async function handleBulkSave(rows: RowData[]) {
    const expenses = rows.map((r) => ({
      category_id: r.category_id,
      sub_item_id: r.sub_item_id || null,
      amount: Number(r.amount),
      vendor: r.vendor || null,
      date: r.date,
      notes: r.notes || null,
    }));

    try {
      const res = await fetch("/api/expenses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error };
      }

      const data = await res.json();
      return { success: true, results: data.results };
    } catch {
      return { success: false, error: "Network error" };
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--error-text)]">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Add Expenses
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {entryMode === "bulk"
              ? "Paste expenses one per line: date / vendor / amount / category / sub-item / notes"
              : "Add a single expense"}
          </p>
        </div>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setEntryMode("bulk")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              entryMode === "bulk"
                ? "bg-[var(--interactive)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Bulk Paste
          </button>
          <button
            onClick={() => setEntryMode("quick")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              entryMode === "quick"
                ? "bg-[var(--interactive)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Quick Add
          </button>
        </div>
      </div>

      {entryMode === "bulk" ? (
        <BulkPasteEntry categories={categories} onSave={handleBulkSave} />
      ) : (
        <QuickAddForm categories={categories} />
      )}
    </div>
  );
}

function QuickAddForm({ categories }: { categories: BudgetCategory[] }) {
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [subItemId, setSubItemId] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successCount, setSuccessCount] = useState(0);

  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const hasSubItems = selectedCategory && selectedCategory.sub_items.length > 0;

  const fetchVendorSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setVendorSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/expenses?vendor_suggest=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setVendorSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchVendorSuggestions(vendor), 300);
    return () => clearTimeout(timer);
  }, [vendor, fetchVendorSuggestions]);

  async function autoCategorize(vendorName: string) {
    if (categoryId) return;
    try {
      const res = await fetch(`/api/vendors/match?vendor=${encodeURIComponent(vendorName)}`);
      if (res.ok) {
        const match = await res.json();
        if (match && match.category_id) {
          setCategoryId(match.category_id);
          if (match.sub_item_id) setSubItemId(match.sub_item_id);
        }
      }
    } catch {
      /* empty */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!amount || isNaN(Number(amount))) { setFormError("Enter a valid amount"); return; }
    if (!categoryId) { setFormError("Select a category"); return; }
    if (!date) { setFormError("Select a date"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          sub_item_id: subItemId || null,
          amount: Number(amount),
          vendor: vendor.trim() || null,
          date,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      // Reset for next entry
      setSuccessCount((c) => c + 1);
      setAmount("");
      setVendor("");
      setNotes("");
      setCategoryId("");
      setSubItemId("");
      amountRef.current?.focus();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6">
      {successCount > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--success-solid)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {successCount} expense{successCount !== 1 ? "s" : ""} saved! Keep adding more below.
        </div>
      )}

      {formError && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-7 pr-3 text-lg font-semibold text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubItemId("");
              }}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {hasSubItems ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                Sub-Item
              </label>
              <select
                value={subItemId}
                onChange={(e) => setSubItemId(e.target.value)}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
              >
                <option value="">Select sub-item...</option>
                {selectedCategory.sub_items.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
        </div>

        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Vendor
          </label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            onFocus={() => vendorSuggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
              if (vendor.trim()) autoCategorize(vendor.trim());
            }}
            placeholder="e.g. Farm Supply Co"
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          />
          {showSuggestions && vendorSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
              {vendorSuggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      setVendor(s);
                      setShowSuggestions(false);
                      autoCategorize(s);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !amount || !categoryId}
          className="w-full rounded-lg bg-[var(--interactive)] py-3 text-sm font-semibold text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Expense"}
        </button>
      </form>
    </div>
  );
}
