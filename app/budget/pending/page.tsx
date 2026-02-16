"use client";

import { useState, useEffect, useCallback } from "react";

interface PendingExpense {
  id: string;
  amount: number;
  vendor: string | null;
  date: string;
  notes: string | null;
  source: string;
  category_id: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function PendingExpensesPage() {
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, categoriesRes] = await Promise.all([
        fetch("/api/email/pending"),
        fetch("/api/budget/categories"),
      ]);
      if (pendingRes.ok) setPending(await pendingRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch {
      setError("Failed to load pending expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove(
    expenseId: string,
    categoryId: string,
    vendor: string | null,
    saveMapping: boolean
  ) {
    try {
      const res = await fetch(`/api/email/pending/${expenseId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId }),
      });
      if (!res.ok) throw new Error("Failed to approve");

      // Optionally save vendor mapping for future auto-categorization
      if (saveMapping && vendor) {
        await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_pattern: vendor,
            category_id: categoryId,
          }),
        });
      }

      setPending((prev) => prev.filter((p) => p.id !== expenseId));
      setSuccess("Expense approved" + (saveMapping ? " and vendor mapping saved" : ""));
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to approve expense");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading pending expenses...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Pending Email Expenses
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Review and categorize expenses from email ingestion
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {success}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No pending expenses to review.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Expenses from email ingestion that need categorization will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((expense) => (
            <PendingExpenseCard
              key={expense.id}
              expense={expense}
              categories={categories}
              onApprove={handleApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingExpenseCard({
  expense,
  categories,
  onApprove,
}: {
  expense: PendingExpense;
  categories: Category[];
  onApprove: (id: string, categoryId: string, vendor: string | null, saveMapping: boolean) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || ""
  );
  const [saveMapping, setSaveMapping] = useState(true);

  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-[var(--text-primary)]">
            ${Number(expense.amount).toFixed(2)}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {expense.vendor || "Unknown vendor"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {new Date(expense.date + "T00:00:00").toLocaleDateString()} &bull; {expense.source}
          </p>
          {expense.notes && (
            <p className="mt-1 text-xs text-[var(--text-muted)] italic">
              {expense.notes}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() =>
            onApprove(expense.id, selectedCategory, expense.vendor, saveMapping)
          }
          disabled={!selectedCategory}
          className="rounded-lg bg-[var(--interactive)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
      </div>

      {expense.vendor && (
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={saveMapping}
            onChange={(e) => setSaveMapping(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--input-border)]"
          />
          Remember &ldquo;{expense.vendor}&rdquo; for this category
        </label>
      )}
    </div>
  );
}
