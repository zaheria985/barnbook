"use client";

import { useState, useEffect, useRef } from "react";
import BulkPasteEntry from "@/components/budget/BulkPasteEntry";
import TagPicker from "@/components/ui/TagPicker";
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

interface VendorTag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_sub_item_id: string | null;
}

function QuickAddForm({ categories }: { categories: BudgetCategory[] }) {
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [subItemId, setSubItemId] = useState("");
  const [vendorTags, setVendorTags] = useState<VendorTag[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const hasSubItems = selectedCategory && selectedCategory.sub_items.length > 0;

  function handleVendorTagSelected(tag: VendorTag) {
    if (!categoryId && tag.default_category_id) {
      setCategoryId(tag.default_category_id);
      if (tag.default_sub_item_id) setSubItemId(tag.default_sub_item_id);
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
          vendor: vendorTags.length > 0 ? vendorTags[0].name : null,
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
      setVendorTags([]);
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

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Vendor
          </label>
          <TagPicker
            tagType="vendor"
            selected={vendorTags}
            onChange={setVendorTags}
            singleSelect
            allowCreate
            placeholder="e.g. Farm Supply Co"
            onTagSelected={handleVendorTagSelected}
          />
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
