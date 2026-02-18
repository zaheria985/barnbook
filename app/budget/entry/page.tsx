"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

export default function QuickEntryPage() {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [subItemId, setSubItemId] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const fetchVendorSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setVendorSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/expenses?vendor_suggest=${encodeURIComponent(query)}`
      );
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
    if (categoryId) return; // Don't override if already set
    try {
      const res = await fetch(`/api/vendors/match?vendor=${encodeURIComponent(vendorName)}`);
      if (res.ok) {
        const match = await res.json();
        if (match && match.category_id) {
          setCategoryId(match.category_id);
          if (match.sub_item_id) {
            setSubItemId(match.sub_item_id);
          }
        }
      }
    } catch {
      // Silently ignore - auto-categorization is a nice-to-have
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
          vendor: vendor.trim() || null,
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
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]"
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
