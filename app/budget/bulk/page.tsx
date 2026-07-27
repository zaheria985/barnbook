"use client";

import { useState, useEffect } from "react";
import BulkPasteEntry from "@/components/budget/BulkPasteEntry";
import QuickAddExpenseForm from "@/components/budget/QuickAddExpenseForm";
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
    <div className="mx-auto max-w-4xl">
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
        <QuickAddExpenseForm categories={categories} variant="embedded" />
      )}
    </div>
  );
}
