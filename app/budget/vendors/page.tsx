"use client";

import { useState, useEffect, useCallback } from "react";
import MonthSelector from "@/components/budget/MonthSelector";

interface VendorSpending {
  vendor: string;
  transaction_count: number;
  total_spent: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function VendorSpendingPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [allTime, setAllTime] = useState(false);
  const [data, setData] = useState<VendorSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = allTime ? "" : `?month=${month}`;
      const res = await fetch(`/api/expenses/vendor-spending${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError("Failed to load vendor spending");
    } finally {
      setLoading(false);
    }
  }, [month, allTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSpent = data.reduce((s, v) => s + Number(v.total_spent), 0);
  const totalTransactions = data.reduce((s, v) => s + v.transaction_count, 0);

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Vendor Spending</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={allTime}
              onChange={(e) => setAllTime(e.target.checked)}
              className="rounded border-[var(--input-border)]"
            />
            All Time
          </label>
          {!allTime && <MonthSelector value={month} onChange={setMonth} />}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
          No vendor expenses found for this period.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Vendor</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Transactions</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.vendor} className="border-t border-[var(--border-light)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{v.vendor}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{v.transaction_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">{formatCurrency(Number(v.total_spent))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-muted)]">
                <td className="px-4 py-3 font-bold text-[var(--text-primary)]">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">{totalTransactions}</td>
                <td className="px-4 py-3 text-right font-bold text-[var(--text-primary)]">{formatCurrency(totalSpent)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
