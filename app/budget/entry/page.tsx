"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QuickAddExpenseForm from "@/components/budget/QuickAddExpenseForm";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

export default function QuickEntryPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/budget/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => setError("Failed to load categories"));
  }, []);

  function handleSaved() {
    setSuccess(true);
    setTimeout(() => router.push("/budget"), 800);
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

      <QuickAddExpenseForm
        categories={categories}
        variant="page"
        onSaved={handleSaved}
      />
    </div>
  );
}
