"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import type { BudgetCategory } from "@/lib/queries/budget-categories";
import Modal from "@/components/ui/Modal";

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

interface ParsedRow {
  date: string;
  category: string;
  vendor: string;
  amount: string;
  notes: string;
  valid: boolean;
  error?: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function parseDate(input: string): string | null {
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // M/D/YY
  ];

  for (const regex of formats) {
    const match = input.match(regex);
    if (match) {
      if (regex.source.includes("{4}")) {
        return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
      } else if (regex.source.includes("{2}$")) {
        const year = parseInt(match[3]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return `${fullYear}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
      } else {
        return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
      }
    }
  }
  return null;
}

export default function BulkEntryTable({
  categories,
  onSave,
}: {
  categories: BudgetCategory[];
  onSave: (rows: RowData[]) => Promise<{ success: boolean; results?: { success: boolean; error?: string }[] }>;
}) {
  const [data, setData] = useState<RowData[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [saveResults, setSaveResults] = useState<{ success: boolean; error?: string }[] | null>(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const categoryMap = useMemo(() => {
    const map = new Map<string, BudgetCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const addRow = useCallback(() => {
    setData((prev) => [
      ...prev,
      {
        id: generateId(),
        date: today,
        category_id: "",
        sub_item_id: "",
        vendor: "",
        amount: "",
        notes: "",
      },
    ]);
  }, [today]);

  const removeRow = useCallback((id: string) => {
    setData((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, updates: Partial<RowData>) => {
    setData((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.category_id) {
          updated.sub_item_id = "";
        }
        return updated;
      })
    );
  }, []);

  const validateRow = (row: RowData): string[] => {
    const errors: string[] = [];
    if (!row.date) errors.push("Date required");
    if (!row.category_id) errors.push("Category required");
    if (!row.amount || isNaN(Number(row.amount))) errors.push("Valid amount required");
    return errors;
  };

  const handleSave = async () => {
    const validated = data.map((row) => ({ ...row, errors: validateRow(row) }));
    setData(validated);

    const hasErrors = validated.some((r) => r.errors?.length > 0);
    if (hasErrors) return;

    setSaving(true);
    try {
      const result = await onSave(validated);
      setSaveResults(result.results || null);
      if (result.success) {
        setData([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const text = e.clipboardData.getData("text");
      if (!text.includes("\t")) return;

      e.preventDefault();
      const lines = text.trim().split("\n");
      const parsed: ParsedRow[] = lines.map((line) => {
        const cols = line.split("\t");
        const date = parseDate(cols[0] || "");
        const categoryName = cols[1]?.trim() || "";
        const vendor = cols[2]?.trim() || "";
        const amount = cols[3]?.trim() || "";
        const notes = cols[4]?.trim() || "";

        const category = categories.find(
          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
        );

        if (!date) {
          return { date: cols[0], category: categoryName, vendor, amount, notes, valid: false, error: "Invalid date" };
        }
        if (!category) {
          return { date: cols[0], category: categoryName, vendor, amount, notes, valid: false, error: "Category not found" };
        }
        if (!amount || isNaN(Number(amount))) {
          return { date: cols[0], category: categoryName, vendor, amount, notes, valid: false, error: "Invalid amount" };
        }

        return { date, category: category.name, vendor, amount, notes, valid: true };
      });

      setParsedRows(parsed);
      setShowPasteModal(true);
    },
    [categories]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const confirmPaste = () => {
    const validRows = parsedRows.filter((r) => r.valid);
    const newRows: RowData[] = validRows.map((r) => {
      const category = categories.find((c) => c.name.toLowerCase() === r.category.toLowerCase());
      return {
        id: generateId(),
        date: r.date,
        category_id: category?.id || "",
        sub_item_id: "",
        vendor: r.vendor,
        amount: r.amount,
        notes: r.notes,
      };
    });
    setData((prev) => [...prev, ...newRows]);
    setShowPasteModal(false);
  };

  const columns = useMemo<ColumnDef<RowData>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <input
            type="date"
            value={row.original.date}
            onChange={(e) => updateRow(row.original.id, { date: e.target.value })}
            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
          />
        ),
      },
      {
        accessorKey: "category_id",
        header: "Category",
        cell: ({ row }) => (
          <select
            value={row.original.category_id}
            onChange={(e) => updateRow(row.original.id, { category_id: e.target.value })}
            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
          >
            <option value="">Select...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ),
      },
      {
        accessorKey: "sub_item_id",
        header: "Sub-Item",
        cell: ({ row }) => {
          const cat = categoryMap.get(row.original.category_id);
          if (!cat || cat.sub_items.length === 0) return <span className="text-[var(--text-muted)]">—</span>;
          return (
            <select
              value={row.original.sub_item_id}
              onChange={(e) => updateRow(row.original.id, { sub_item_id: e.target.value })}
              className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
            >
              <option value="">Select...</option>
              {cat.sub_items.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          );
        },
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.vendor}
            onChange={(e) => updateRow(row.original.id, { vendor: e.target.value })}
            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
          />
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <input
            type="number"
            step="0.01"
            value={row.original.amount}
            onChange={(e) => updateRow(row.original.id, { amount: e.target.value })}
            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
          />
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <input
            type="text"
            value={row.original.notes}
            onChange={(e) => updateRow(row.original.id, { notes: e.target.value })}
            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            onClick={() => removeRow(row.original.id)}
            className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--error-text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        ),
      },
    ],
    [categories, categoryMap, updateRow, removeRow]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={row.original.errors?.length ? "bg-[var(--error-bg)]" : ""}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No rows. Click &quot;Add Row&quot; or paste from spreadsheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.some((r) => r.errors?.length) && (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          Please fix errors before saving.
        </div>
      )}

      {saveResults && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${saveResults.every((r) => r.success) ? "border-[var(--success-solid)] bg-[var(--success-bg)] text-[var(--success-text)]" : "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]"}`}>
          {saveResults.every((r) => r.success)
            ? `Saved ${saveResults.length} expenses successfully!`
            : `Some rows failed: ${saveResults.filter((r) => !r.success).length} errors`}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={addRow}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          + Add Row
        </button>
        <button
          onClick={handleSave}
          disabled={saving || data.length === 0}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      <Modal open={showPasteModal} onClose={() => setShowPasteModal(false)} title="Paste Preview">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Category</th>
                <th className="py-2 text-left">Vendor</th>
                <th className="py-2 text-left">Amount</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((row, i) => (
                <tr key={i} className={row.valid ? "" : "bg-[var(--error-bg)]"}>
                  <td className="py-2">{row.date}</td>
                  <td className="py-2">{row.category}</td>
                  <td className="py-2">{row.vendor}</td>
                  <td className="py-2">{row.amount}</td>
                  <td className="py-2 text-xs">
                    {row.valid ? (
                      <span className="text-[var(--success-text)]">Valid</span>
                    ) : (
                      <span className="text-[var(--error-text)]">{row.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={confirmPaste}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)]"
          >
            Add Valid Rows ({parsedRows.filter((r) => r.valid).length})
          </button>
          <button
            onClick={() => setShowPasteModal(false)}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
