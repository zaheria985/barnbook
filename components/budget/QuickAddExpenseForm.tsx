"use client";

import { useState, useEffect, useRef } from "react";
import TagPicker from "@/components/ui/TagPicker";
import type { BudgetCategory } from "@/lib/queries/budget-categories";
import { localToday } from "@/lib/dates";

interface VendorTag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_sub_item_id: string | null;
}

/**
 * Single-expense entry form, shared by /budget/entry (page variant) and the
 * Quick Add mode on /budget/bulk (embedded variant).
 *
 * - page: large single-column inputs; calls onSaved once after a success.
 * - embedded: two-column compact inputs; resets for the next entry and shows
 *   a running saved-count banner.
 */
export default function QuickAddExpenseForm({
  categories,
  variant,
  onSaved,
}: {
  categories: BudgetCategory[];
  variant: "page" | "embedded";
  onSaved?: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [categoryId, setCategoryId] = useState("");
  const [subItemId, setSubItemId] = useState("");
  const [vendorTags, setVendorTags] = useState<VendorTag[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const hasSubItems = selectedCategory && selectedCategory.sub_items.length > 0;

  const page = variant === "page";
  const inputClass = page
    ? "w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
    : "w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]";
  const labelClass =
    "mb-1 block text-sm font-medium text-[var(--text-secondary)]";

  function handleVendorTagSelected(tag: VendorTag) {
    if (!categoryId && tag.default_category_id) {
      setCategoryId(tag.default_category_id);
      if (tag.default_sub_item_id) setSubItemId(tag.default_sub_item_id);
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

      if (page) {
        onSaved?.();
      } else {
        // Reset for the next entry
        setSuccessCount((c) => c + 1);
        setAmount("");
        setVendorTags([]);
        setNotes("");
        setCategoryId("");
        setSubItemId("");
        amountRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  const amountField = (
    <div>
      <label className={labelClass}>Amount</label>
      <div className="relative">
        <span
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] ${page ? "text-lg" : ""}`}
        >
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
          className={
            page
              ? "w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-4 pl-8 pr-4 text-2xl font-semibold text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
              : "w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-7 pr-3 text-lg font-semibold text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
          }
        />
      </div>
    </div>
  );

  const dateField = (
    <div>
      <label className={labelClass}>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={inputClass}
      />
    </div>
  );

  const categoryField = (
    <div>
      <label className={labelClass}>Category</label>
      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setSubItemId("");
        }}
        className={inputClass}
      >
        <option value="">Select category...</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );

  const subItemField = hasSubItems ? (
    <div>
      <label className={labelClass}>Sub-Item</label>
      <select
        value={subItemId}
        onChange={(e) => setSubItemId(e.target.value)}
        className={inputClass}
      >
        <option value="">Select sub-item...</option>
        {selectedCategory.sub_items.map((sub) => (
          <option key={sub.id} value={sub.id}>
            {sub.label}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <div
      className={
        page
          ? ""
          : "rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6"
      }
    >
      {!page && successCount > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--success-solid)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {successCount} expense{successCount !== 1 ? "s" : ""} saved! Keep
          adding more below.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {page ? (
          <>
            {amountField}
            {dateField}
            {categoryField}
            {subItemField}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {amountField}
              {dateField}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {categoryField}
              {subItemField ?? <div />}
            </div>
          </>
        )}

        <div>
          <label className={labelClass}>Vendor</label>
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
          <label className={labelClass}>Notes</label>
          {page ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className={inputClass}
            />
          ) : (
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className={inputClass}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !amount || !categoryId}
          className={
            page
              ? "w-full rounded-xl bg-[var(--interactive)] py-4 text-lg font-semibold text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
              : "w-full rounded-lg bg-[var(--interactive)] py-3 text-sm font-semibold text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
          }
        >
          {saving ? "Saving..." : "Save Expense"}
        </button>
      </form>
    </div>
  );
}
