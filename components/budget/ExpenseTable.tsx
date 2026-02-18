"use client";

import { useState } from "react";
import type { Expense } from "@/lib/queries/expenses";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type EditFields = Partial<{
  amount: string;
  vendor: string;
  date: string;
  notes: string;
  category_id: string;
  sub_item_id: string;
}>;

export default function ExpenseTable({
  expenses,
  categories,
  readOnly = false,
  showCategory = false,
  onChanged,
}: {
  expenses: Expense[];
  categories: BudgetCategory[];
  readOnly?: boolean;
  showCategory?: boolean;
  onChanged: () => void;
}) {
  const [pendingEdits, setPendingEdits] = useState<Record<string, EditFields>>(
    {}
  );
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  function getEditValue<K extends keyof EditFields>(
    expense: Expense,
    field: K
  ): string {
    const pending = pendingEdits[expense.id];
    if (pending && pending[field] !== undefined) return pending[field] as string;

    switch (field) {
      case "amount":
        return String(expense.amount);
      case "vendor":
        return expense.vendor || "";
      case "date":
        return typeof expense.date === "string"
          ? expense.date.substring(0, 10)
          : "";
      case "notes":
        return expense.notes || "";
      case "category_id":
        return expense.category_id;
      case "sub_item_id":
        return expense.sub_item_id || "";
      default:
        return "";
    }
  }

  function setEditField(expenseId: string, field: keyof EditFields, value: string) {
    setPendingEdits((prev) => ({
      ...prev,
      [expenseId]: { ...prev[expenseId], [field]: value },
    }));
  }

  async function saveField(expense: Expense, field: keyof EditFields) {
    const pending = pendingEdits[expense.id];
    if (!pending || pending[field] === undefined) return;

    const newValue = pending[field]!;
    let originalValue: string;
    switch (field) {
      case "amount":
        originalValue = String(expense.amount);
        break;
      case "vendor":
        originalValue = expense.vendor || "";
        break;
      case "date":
        originalValue = typeof expense.date === "string" ? expense.date.substring(0, 10) : "";
        break;
      case "notes":
        originalValue = expense.notes || "";
        break;
      case "category_id":
        originalValue = expense.category_id;
        break;
      case "sub_item_id":
        originalValue = expense.sub_item_id || "";
        break;
      default:
        originalValue = "";
    }

    if (newValue === originalValue) {
      setPendingEdits((prev) => {
        const next = { ...prev };
        if (next[expense.id]) {
          const updated = { ...next[expense.id] };
          delete updated[field];
          if (Object.keys(updated).length === 0) delete next[expense.id];
          else next[expense.id] = updated;
        }
        return next;
      });
      return;
    }

    const body: Record<string, unknown> = {};
    if (field === "amount") body.amount = Number(newValue) || 0;
    else if (field === "sub_item_id") body.sub_item_id = newValue || null;
    else body[field] = newValue || null;

    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 403) {
        setError("Cannot edit expenses in a closed month");
        return;
      }
      if (!res.ok) throw new Error("Failed to update");
      setPendingEdits((prev) => {
        const next = { ...prev };
        if (next[expense.id]) {
          const updated = { ...next[expense.id] };
          delete updated[field];
          if (Object.keys(updated).length === 0) delete next[expense.id];
          else next[expense.id] = updated;
        }
        return next;
      });
      onChanged();
    } catch {
      setError("Failed to save change");
    }
  }

  async function handleCategoryChange(expense: Expense, newCategoryId: string) {
    setEditField(expense.id, "category_id", newCategoryId);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: newCategoryId, sub_item_id: null }),
      });
      if (res.status === 403) {
        setError("Cannot edit expenses in a closed month");
        return;
      }
      if (!res.ok) throw new Error("Failed to update");
      setPendingEdits((prev) => {
        const next = { ...prev };
        if (next[expense.id]) {
          const updated = { ...next[expense.id] };
          delete updated.category_id;
          delete updated.sub_item_id;
          if (Object.keys(updated).length === 0) delete next[expense.id];
          else next[expense.id] = updated;
        }
        return next;
      });
      onChanged();
    } catch {
      setError("Failed to update category");
    }
  }

  async function handleSubItemChange(expense: Expense, newSubItemId: string) {
    setEditField(expense.id, "sub_item_id", newSubItemId);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_item_id: newSubItemId || null }),
      });
      if (res.status === 403) {
        setError("Cannot edit expenses in a closed month");
        return;
      }
      if (!res.ok) throw new Error("Failed to update");
      setPendingEdits((prev) => {
        const next = { ...prev };
        if (next[expense.id]) {
          const updated = { ...next[expense.id] };
          delete updated.sub_item_id;
          if (Object.keys(updated).length === 0) delete next[expense.id];
          else next[expense.id] = updated;
        }
        return next;
      });
      onChanged();
    } catch {
      setError("Failed to update sub-item");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        setError("Cannot delete expenses in a closed month");
        setConfirmingDelete(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to delete");
      setConfirmingDelete(null);
      onChanged();
    } catch {
      setError("Failed to delete expense");
    }
  }

  function getSubItemsForExpense(expense: Expense): { id: string; label: string }[] {
    const catId = getEditValue(expense, "category_id");
    const cat = categories.find((c) => c.id === catId);
    return cat?.sub_items || [];
  }

  if (expenses.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--text-muted)]">
        No expenses recorded
      </p>
    );
  }

  const inputClass =
    "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-[var(--text-primary)] hover:border-[var(--border-light)] focus:border-[var(--input-focus-ring)] focus:bg-[var(--input-bg)] focus:outline-none transition-colors";
  const selectClass =
    "w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm text-[var(--text-primary)] hover:border-[var(--border-light)] focus:border-[var(--input-focus-ring)] focus:bg-[var(--input-bg)] focus:outline-none transition-colors appearance-none cursor-pointer";

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-light)] text-left text-xs text-[var(--text-muted)]">
              <th className="pb-2 pr-2 font-medium">Date</th>
              <th className="pb-2 pr-2 font-medium">Vendor</th>
              <th className="pb-2 pr-2 font-medium text-right">Amount</th>
              {showCategory && (
                <th className="pb-2 pr-2 font-medium">Category</th>
              )}
              <th className="pb-2 pr-2 font-medium">Sub-Item</th>
              <th className="pb-2 pr-2 font-medium">Notes</th>
              {!readOnly && <th className="pb-2 font-medium w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr
                key={exp.id}
                className="border-b border-[var(--border-light)] last:border-0"
              >
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <span className="text-sm">{formatDate(exp.date)}</span>
                  ) : (
                    <input
                      type="date"
                      value={getEditValue(exp, "date")}
                      onChange={(e) =>
                        setEditField(exp.id, "date", e.target.value)
                      }
                      onBlur={() => saveField(exp, "date")}
                      className={`${inputClass} w-28`}
                    />
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <span className="text-sm">{exp.vendor || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={getEditValue(exp, "vendor")}
                      onChange={(e) =>
                        setEditField(exp.id, "vendor", e.target.value)
                      }
                      onBlur={() => saveField(exp, "vendor")}
                      placeholder="—"
                      className={`${inputClass} w-32`}
                    />
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {readOnly ? (
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(exp.amount))}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={getEditValue(exp, "amount")}
                      onChange={(e) =>
                        setEditField(exp.id, "amount", e.target.value)
                      }
                      onBlur={() => saveField(exp, "amount")}
                      className={`${inputClass} w-24 text-right`}
                    />
                  )}
                </td>
                {showCategory && (
                  <td className="py-1.5 pr-2">
                    {readOnly ? (
                      <span className="text-sm">{exp.category_name}</span>
                    ) : (
                      <select
                        value={getEditValue(exp, "category_id")}
                        onChange={(e) =>
                          handleCategoryChange(exp, e.target.value)
                        }
                        className={`${selectClass} w-36`}
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                )}
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <span className="text-sm">
                      {exp.sub_item_label || "—"}
                    </span>
                  ) : (
                    <select
                      value={getEditValue(exp, "sub_item_id")}
                      onChange={(e) => handleSubItemChange(exp, e.target.value)}
                      className={`${selectClass} w-32`}
                    >
                      <option value="">—</option>
                      {getSubItemsForExpense(exp).map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <span className="text-sm text-[var(--text-muted)]">
                      {exp.notes || "—"}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={getEditValue(exp, "notes")}
                      onChange={(e) =>
                        setEditField(exp.id, "notes", e.target.value)
                      }
                      onBlur={() => saveField(exp, "notes")}
                      placeholder="—"
                      className={`${inputClass} w-32`}
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="py-1.5">
                    {confirmingDelete === exp.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="text-[var(--error-text)]">Delete?</span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="font-medium text-[var(--error-text)] hover:underline"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="font-medium text-[var(--text-muted)] hover:underline"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(exp.id)}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error-text)]"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {expenses.map((exp) => (
          <div
            key={exp.id}
            className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] p-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  {readOnly ? (
                    <span className="text-sm font-medium">
                      {formatDate(exp.date)}
                    </span>
                  ) : (
                    <input
                      type="date"
                      value={getEditValue(exp, "date")}
                      onChange={(e) =>
                        setEditField(exp.id, "date", e.target.value)
                      }
                      onBlur={() => saveField(exp, "date")}
                      className={`${inputClass} w-32`}
                    />
                  )}
                  {readOnly ? (
                    <span className="font-semibold">
                      {formatCurrency(Number(exp.amount))}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={getEditValue(exp, "amount")}
                      onChange={(e) =>
                        setEditField(exp.id, "amount", e.target.value)
                      }
                      onBlur={() => saveField(exp, "amount")}
                      className={`${inputClass} w-24 text-right font-medium`}
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)]">Vendor</label>
                  {readOnly ? (
                    <p className="text-sm">{exp.vendor || "—"}</p>
                  ) : (
                    <input
                      type="text"
                      value={getEditValue(exp, "vendor")}
                      onChange={(e) =>
                        setEditField(exp.id, "vendor", e.target.value)
                      }
                      onBlur={() => saveField(exp, "vendor")}
                      placeholder="—"
                      className={inputClass}
                    />
                  )}
                </div>

                {showCategory && (
                  <div>
                    <label className="text-xs text-[var(--text-muted)]">
                      Category
                    </label>
                    {readOnly ? (
                      <p className="text-sm">{exp.category_name}</p>
                    ) : (
                      <select
                        value={getEditValue(exp, "category_id")}
                        onChange={(e) =>
                          handleCategoryChange(exp, e.target.value)
                        }
                        className={selectClass}
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs text-[var(--text-muted)]">Sub-Item</label>
                  {readOnly ? (
                    <p className="text-sm">{exp.sub_item_label || "—"}</p>
                  ) : (
                    <select
                      value={getEditValue(exp, "sub_item_id")}
                      onChange={(e) => handleSubItemChange(exp, e.target.value)}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {getSubItemsForExpense(exp).map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)]">Notes</label>
                  {readOnly ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      {exp.notes || "—"}
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={getEditValue(exp, "notes")}
                      onChange={(e) =>
                        setEditField(exp.id, "notes", e.target.value)
                      }
                      onBlur={() => saveField(exp, "notes")}
                      placeholder="—"
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              {!readOnly && (
                <div className="ml-2 flex-shrink-0">
                  {confirmingDelete === exp.id ? (
                    <div className="flex flex-col items-center gap-1 text-xs">
                      <span className="text-[var(--error-text)]">Delete?</span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="font-medium text-[var(--error-text)] hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="font-medium text-[var(--text-muted)] hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(exp.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error-text)]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
