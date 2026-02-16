"use client";

import { useState, useEffect } from "react";
import BulkEntryTable from "@/components/budget/BulkEntryTable";
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

  async function handleSave(rows: RowData[]) {
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

  if (error) {
    return (
      <div className="py-12 text-center text-[var(--error-text)]">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Bulk Expense Entry
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Add multiple expenses at once. Paste from spreadsheet (tab-separated) or add rows manually.
        </p>
      </div>

      <BulkEntryTable categories={categories} onSave={handleSave} />
    </div>
  );
}
