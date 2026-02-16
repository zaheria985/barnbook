"use client";

import { useState, useEffect, useCallback } from "react";
import MonthSelector from "@/components/budget/MonthSelector";
import Modal from "@/components/ui/Modal";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

interface BalanceData {
  year_month: string;
  total_budgeted: number;
  total_spent: number;
  total_income_actual: number;
  total_sales: number;
  previous_deficit: number;
  net_result: number;
  savings_contribution: number;
  savings_withdrawal: number;
  deficit_carryover: number;
  savings_balance: number;
  is_closed: boolean;
  is_live?: boolean;
}

export default function MonthEndClosePage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/balance?month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load balance data");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleClose() {
    setClosing(true);
    try {
      const res = await fetch("/api/budget/close-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to close month");
      }

      setSuccess(true);
      setShowConfirm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close month");
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-[var(--error-text)]">{error || "Error"}</div>
    );
  }

  const net = data.net_result;
  const isSurplus = net > 0;
  const isDeficit = net < 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Month-End Review
        </h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-solid)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          Month closed successfully!
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Summary</h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Total Income (Actual)</span>
              <span className="font-medium text-[var(--text-primary)]">{formatCurrency(data.total_income_actual)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Total Sales</span>
              <span className="font-medium text-[var(--text-primary)]">{formatCurrency(data.total_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Total Spent</span>
              <span className="font-medium text-[var(--text-primary)]">-{formatCurrency(data.total_spent)}</span>
            </div>
            {data.previous_deficit > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Previous Deficit</span>
                <span className="font-medium text-[var(--error-text)]">-{formatCurrency(data.previous_deficit)}</span>
              </div>
            )}

            <div className="border-t border-[var(--border)] pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-[var(--text-primary)]">Net Result</span>
                <span className={isSurplus ? "text-[var(--success-text)]" : isDeficit ? "text-[var(--error-text)]" : "text-[var(--text-primary)]"}>
                  {formatCurrency(net)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isSurplus && (
          <div className="rounded-xl border border-[var(--success-solid)] bg-[var(--success-bg)] p-4">
            <p className="text-[var(--success-text)]">
              Surplus of {formatCurrency(net)} will be added to the Horse Savings Account.
            </p>
          </div>
        )}

        {isDeficit && (
          <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4">
            {data.savings_withdrawal > 0 && data.deficit_carryover > 0 ? (
              <p className="text-[var(--error-text)]">
                Savings will cover {formatCurrency(data.savings_withdrawal)}, remaining{" "}
                {formatCurrency(data.deficit_carryover)} carries to next month.
              </p>
            ) : data.savings_withdrawal > 0 ? (
              <p className="text-[var(--error-text)]">
                Savings will cover the {formatCurrency(Math.abs(net))} deficit.
              </p>
            ) : (
              <p className="text-[var(--error-text)]">
                Full {formatCurrency(Math.abs(net))} deficit carries to next month.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-muted)] p-4">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Current Savings Balance</span>
            <span className="font-medium text-[var(--text-primary)]">{formatCurrency(data.savings_balance)}</span>
          </div>
        </div>

        {!data.is_closed ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full rounded-xl bg-[var(--interactive)] py-4 text-lg font-semibold text-white hover:bg-[var(--interactive-hover)]"
          >
            Close Month
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
            <p className="font-medium text-[var(--text-primary)]">This month is closed.</p>
            <p className="text-sm text-[var(--text-muted)]">No further edits can be made.</p>
          </div>
        )}
      </div>

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Month-End Close"
      >
        <p className="mb-4 text-[var(--text-secondary)]">
          Close {new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}?
          This will lock the month and update savings.
        </p>

        <div className="mb-4 rounded-lg bg-[var(--surface-muted)] p-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Net Result</span>
            <span className={isSurplus ? "text-[var(--success-text)]" : isDeficit ? "text-[var(--error-text)]" : ""}>
              {formatCurrency(net)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleClose}
            disabled={closing}
            className="flex-1 rounded-lg bg-[var(--interactive)] py-2 font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {closing ? "Closing..." : "Confirm Close"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={closing}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
