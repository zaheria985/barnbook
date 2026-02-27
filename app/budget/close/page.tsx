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
  net_result: number;
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
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
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

  async function handleReopen() {
    setReopening(true);
    try {
      const res = await fetch("/api/budget/reopen-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reopen month");
      }

      setSuccess(true);
      setShowReopenConfirm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen month");
    } finally {
      setReopening(false);
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
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
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

        {(() => {
          const savingsAfter = data.savings_balance + net;
          const borderColor = isDeficit && savingsAfter < 0
            ? "border-[var(--error-border)]"
            : isSurplus
            ? "border-[var(--success-solid)]"
            : "border-[var(--border-light)]";
          const bgColor = isDeficit && savingsAfter < 0
            ? "bg-[var(--error-bg)]"
            : isSurplus
            ? "bg-[var(--success-bg)]"
            : "bg-[var(--surface-muted)]";
          return (
            <div className={`rounded-2xl border ${borderColor} ${bgColor} p-4`}>
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Horse Savings Account</p>
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-[var(--text-secondary)]">{formatCurrency(data.savings_balance)}</span>
                <span className="text-[var(--text-muted)]">&rarr;</span>
                <span className={savingsAfter >= 0 ? "text-[var(--success-text)]" : "text-[var(--error-text)]"}>
                  {formatCurrency(savingsAfter)}
                </span>
              </div>
              <p className={`mt-1 text-sm ${isSurplus ? "text-[var(--success-text)]" : isDeficit ? "text-[var(--error-text)]" : "text-[var(--text-muted)]"}`}>
                {isSurplus ? `+${formatCurrency(net)}` : isDeficit ? formatCurrency(net) : "No change"}
              </p>
              {savingsAfter < 0 && (
                <p className="mt-2 text-xs text-[var(--error-text)]">
                  Deficit — future surpluses will recover this
                </p>
              )}
            </div>
          );
        })()}

        {!data.is_closed ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full rounded-xl bg-[var(--interactive)] py-4 text-lg font-semibold text-white hover:bg-[var(--interactive-hover)]"
          >
            Close Month
          </button>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
            <p className="font-medium text-[var(--text-primary)]">This month is closed.</p>
            <p className="mb-3 text-sm text-[var(--text-muted)]">No further edits can be made.</p>
            <button
              onClick={() => setShowReopenConfirm(true)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface)]"
            >
              Reopen Month
            </button>
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

      <Modal
        open={showReopenConfirm}
        onClose={() => setShowReopenConfirm(false)}
        title="Reopen Month"
      >
        <p className="mb-4 text-[var(--text-secondary)]">
          Reopen {new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}?
          The savings adjustment of {formatCurrency(net)} will be reversed.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleReopen}
            disabled={reopening}
            className="flex-1 rounded-lg bg-[var(--interactive)] py-2 font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {reopening ? "Reopening..." : "Confirm Reopen"}
          </button>
          <button
            onClick={() => setShowReopenConfirm(false)}
            disabled={reopening}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
