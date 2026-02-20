"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import TagPicker from "@/components/ui/TagPicker";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

interface VendorTag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_sub_item_id: string | null;
}

export default function QuickEntryPage() {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [subItemId, setSubItemId] = useState("");
  const [vendorTags, setVendorTags] = useState<VendorTag[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/budget/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => setError("Failed to load categories"));
  }, []);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const hasSubItems = selectedCategory && selectedCategory.sub_items.length > 0;

  function handleVendorTagSelected(tag: VendorTag) {
    if (!categoryId && tag.default_category_id) {
      setCategoryId(tag.default_category_id);
      if (tag.default_sub_item_id) {
        setSubItemId(tag.default_sub_item_id);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!amount || isNaN(Number(amount))) {
      setError("Enter a valid amount");
      return;
    }
    if (!categoryId) {
      setError("Select a category");
      return;
    }
    if (!date) {
      setError("Select a date");
      return;
    }

    setSaving(true);
    try {
      const vendorName = vendorTags.length > 0 ? vendorTags[0].name : null;
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          sub_item_id: subItemId || null,
          amount: Number(amount),
          vendor: vendorName,
          date,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess(true);
      setTimeout(() => router.push("/budget"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <p className="text-lg font-medium text-[var(--text-primary)]">
          Expense saved!
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Add Expense
      </h1>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[var(--text-muted)]">
              $
            </span>
            <input
              ref={amountRef}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-4 pl-8 pr-4 text-2xl font-semibold text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
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
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          />
        </div>

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
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          >
            <option value="">Select category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {hasSubItems && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Sub-Item
            </label>
            <select
              value={subItemId}
              onChange={(e) => setSubItemId(e.target.value)}
              className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
            >
              <option value="">Select sub-item...</option>
              {selectedCategory.sub_items.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.label}
                </option>
              ))}
            </select>
          </div>
        )}

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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            rows={2}
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !amount || !categoryId}
          className="w-full rounded-xl bg-[var(--interactive)] py-4 text-lg font-semibold text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Expense"}
        </button>
      </form>
    </div>
  );
}
