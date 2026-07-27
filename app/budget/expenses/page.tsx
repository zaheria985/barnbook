"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MonthSelector from "@/components/budget/MonthSelector";
import ExpenseTable, {
  type ExpenseSort,
} from "@/components/budget/ExpenseTable";
import type { Expense } from "@/lib/queries/expenses";
import type { BudgetCategory } from "@/lib/queries/budget-categories";
import PageSkeleton from "@/components/ui/PageSkeleton";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the source of truth for the month, so the page stays linkable
  // and the back button moves between months.
  const monthParam = searchParams.get("month");
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : thisMonth();

  const setMonth = useCallback(
    (m: string) => {
      router.replace(`/budget/expenses?month=${m}`, { scroll: false });
    },
    [router]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [sort, setSort] = useState<ExpenseSort | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        fetch(`/api/expenses?month=${month}`),
        fetch("/api/budget/categories"),
      ]);

      if (!expRes.ok || !catRes.ok) throw new Error("Failed to fetch");

      const [expData, catData] = await Promise.all([
        expRes.json(),
        catRes.json(),
      ]);

      setExpenses(expData);
      setCategories(catData);
    } catch {
      setError("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Distinct vendors present in the loaded month, for the vendor filter.
  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) if (e.vendor) set.add(e.vendor);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = expenses;
    if (q) {
      rows = rows.filter((e) =>
        [e.vendor, e.notes, e.sub_item_label, e.category_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (categoryFilter) {
      rows = rows.filter((e) => e.category_id === categoryFilter);
    }
    if (vendorFilter === "__none__") {
      rows = rows.filter((e) => !e.vendor);
    } else if (vendorFilter) {
      rows = rows.filter((e) => e.vendor === vendorFilter);
    }
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sort.key) {
          case "amount":
            return (Number(a.amount) - Number(b.amount)) * dir;
          case "vendor":
            return (a.vendor || "").localeCompare(b.vendor || "") * dir;
          case "category":
            return a.category_name.localeCompare(b.category_name) * dir;
          default:
            return a.date.localeCompare(b.date) * dir;
        }
      });
    }
    return rows;
  }, [expenses, search, categoryFilter, vendorFilter, sort]);

  const isFiltered = filtered.length !== expenses.length;
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Expenses
        </h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor, notes, category..."
          className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          aria-label="Filter by vendor"
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        >
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          <option value="__none__">(no vendor)</option>
        </select>
      </div>

      {/* Total bar */}
      <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {isFiltered
              ? `${filtered.length} of ${expenses.length} expenses`
              : `${expenses.length} expense${expenses.length !== 1 ? "s" : ""}`}
          </span>
          <span className="text-base font-bold text-[var(--text-primary)]">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        {loading ? (
          <div className="animate-pulse space-y-3 py-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-9 rounded bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : (
          <ExpenseTable
            expenses={filtered}
            categories={categories}
            showCategory={true}
            onChanged={fetchData}
            sort={sort}
            onSortChange={setSort}
          />
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/budget"
          className="text-sm text-[var(--interactive)] hover:underline"
        >
          &larr; Back to Budget
        </Link>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExpensesContent />
    </Suspense>
  );
}
