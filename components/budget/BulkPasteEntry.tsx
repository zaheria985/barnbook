"use client";

import { useState, useMemo, useCallback } from "react";
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

interface BulkPasteEntryProps {
  categories: BudgetCategory[];
  onSave: (rows: RowData[]) => Promise<{ success: boolean; results?: { success: boolean; error?: string }[] }>;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/** Replace common Unicode variants that break splitting and regex matching */
function normalizeText(text: string): string {
  return text
    .replace(/[\u00A0\u2007\u202F]/g, " ")       // non-breaking / figure / narrow nbsp → space
    .replace(/[\u2044\u2215\uFF0F]/g, "/")        // fraction / division / fullwidth slash → /
    .replace(/[\u2013\u2014\uFF0D]/g, "-")        // en-dash / em-dash / fullwidth hyphen → -
    .replace(/\r\n/g, "\n")                        // Windows line endings
    .replace(/\r/g, "\n");                          // old Mac line endings
}

function parseDate(raw: string): string | null {
  const input = raw.trim();
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    /^(\d{1,2})\/(\d{1,2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  ];
  for (const regex of formats) {
    const match = input.match(regex);
    if (!match) continue;
    if (regex === formats[0]) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    if (regex === formats[1] || regex === formats[4] || regex === formats[5])
      return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    if (regex === formats[2]) {
      const year = parseInt(match[3]);
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return `${fullYear}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }
    if (regex === formats[3]) {
      const year = new Date().getFullYear();
      return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }
  }
  return null;
}

export default function BulkPasteEntry({ categories, onSave }: BulkPasteEntryProps) {
  const [mode, setMode] = useState<"paste" | "preview">("paste");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [saveResults, setSaveResults] = useState<{ success: boolean; error?: string }[] | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, BudgetCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const updateRow = useCallback((id: string, updates: Partial<RowData>) => {
    setRows((prev) =>
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

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleParse = async () => {
    const normalized = normalizeText(pasteText);
    const lines = normalized.trim().split("\n").filter((line) => line.trim());
    if (lines.length === 0) return;

    const parsed: RowData[] = [];
    const vendorSet = new Set<string>();

    for (const line of lines) {
      const parts = line.split(" / ").map((p) => p.trim());
      const [rawDate, vendor, rawAmount, categoryName] = parts;

      const date = parseDate(rawDate || "");
      const id = generateId();

      // Match category by name
      let categoryId = "";
      let subItemId = "";
      let notesValue = "";
      const matchedCat = categoryName
        ? categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
        : undefined;

      if (matchedCat) {
        categoryId = matchedCat.id;

        if (parts.length >= 6) {
          // 6+ fields: date / vendor / amount / category / sub-item / notes
          const subItemName = parts[4];
          const sub = matchedCat.sub_items.find(
            (s) => s.label.toLowerCase() === subItemName.toLowerCase()
          );
          if (sub) subItemId = sub.id;
          notesValue = parts.slice(5).join(" / ");
        } else if (parts.length === 5) {
          // 5 fields: check if 5th is a sub-item name, otherwise treat as notes
          const field5 = parts[4];
          const sub = matchedCat.sub_items.find(
            (s) => s.label.toLowerCase() === field5.toLowerCase()
          );
          if (sub) {
            subItemId = sub.id;
          } else {
            notesValue = field5;
          }
        }
      } else {
        // No category match — 5th field is notes
        if (parts.length >= 5) notesValue = parts.slice(4).join(" / ");
      }

      const errors: string[] = [];
      if (!date) errors.push("Invalid date");
      if (!rawAmount || isNaN(Number(rawAmount))) errors.push("Invalid amount");
      if (!vendor) errors.push("Vendor required");

      parsed.push({
        id,
        date: date || "",
        category_id: categoryId,
        sub_item_id: subItemId,
        vendor: vendor || "",
        amount: rawAmount || "",
        notes: notesValue,
        errors: errors.length > 0 ? errors : undefined,
      });

      if (vendor) {
        vendorSet.add(vendor);
      }
    }

    setRows(parsed);
    setMode("preview");

    // Auto-categorize via vendor matching
    if (vendorSet.size > 0) {
      setMatching(true);
      const vendorMatches = new Map<string, { category_id: string; sub_item_id: string | null }>();

      try {
        await Promise.all(
          Array.from(vendorSet).map(async (v) => {
            try {
              const res = await fetch(`/api/vendors/match?vendor=${encodeURIComponent(v)}`);
              if (res.ok) {
                const match = await res.json();
                if (match && match.category_id) {
                  vendorMatches.set(v, {
                    category_id: match.category_id,
                    sub_item_id: match.sub_item_id || null,
                  });
                }
              }
            } catch {
              // Ignore individual vendor match failures
            }
          })
        );

        if (vendorMatches.size > 0) {
          setRows((prev) =>
            prev.map((row) => {
              // Only auto-fill if no category was already set
              if (row.category_id) return row;
              const match = vendorMatches.get(row.vendor);
              if (!match) return row;
              return {
                ...row,
                category_id: match.category_id,
                sub_item_id: match.sub_item_id || "",
              };
            })
          );
        }
      } finally {
        setMatching(false);
      }
    }
  };

  const validateRow = (row: RowData): string[] => {
    const errors: string[] = [];
    if (!row.date) errors.push("Date required");
    if (!row.category_id) errors.push("Category required");
    if (!row.amount || isNaN(Number(row.amount))) errors.push("Valid amount required");
    return errors;
  };

  const handleSave = async () => {
    const validated = rows.map((row) => ({ ...row, errors: validateRow(row) }));
    setRows(validated);

    const hasErrors = validated.some((r) => r.errors && r.errors.length > 0);
    if (hasErrors) return;

    setSaving(true);
    try {
      const result = await onSave(validated);
      setSaveResults(result.results || null);
      if (result.success) {
        setRows([]);
        setPasteText("");
        setMode("paste");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBackToEdit = () => {
    setMode("paste");
    setSaveResults(null);
  };

  if (mode === "paste") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Paste expenses one per line:\n\n" +
              "02/15/2025 / Tractor Supply / 45.99 / Feed / Hay Delivery / grain order\n" +
              "2/16 / Rural King / 23.50 / Supplies\n" +
              "02/17/25 / Vet Clinic / 150.00\n\n" +
              "Format: date / vendor / amount / category / sub-item / notes\n" +
              "Category, sub-item, and notes are optional.\n" +
              "Dates: M/D, M/D/YY, M/D/YYYY, or YYYY-MM-DD"
            }
            rows={12}
            className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--interactive)] focus:outline-none focus:ring-1 focus:ring-[var(--interactive)]"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
            >
              Parse
            </button>
          </div>
        </div>

        {saveResults && saveResults.every((r) => r.success) && (
          <div className="rounded-lg border border-[var(--success-solid)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
            Saved {saveResults.length} expenses successfully!
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matching && (
        <div className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Auto-categorizing vendors...
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Date</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Vendor</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Amount</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Category</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Sub-Item</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Notes</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cat = categoryMap.get(row.category_id);
                return (
                  <tr
                    key={row.id}
                    className={row.errors?.length ? "bg-[var(--error-bg)]" : ""}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.vendor}
                        onChange={(e) => updateRow(row.id, { vendor: e.target.value })}
                        className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                        className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.category_id}
                        onChange={(e) => updateRow(row.id, { category_id: e.target.value })}
                        className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                      >
                        <option value="">Select...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {cat && cat.sub_items.length > 0 ? (
                        <select
                          value={row.sub_item_id}
                          onChange={(e) => updateRow(row.id, { sub_item_id: e.target.value })}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                        >
                          <option value="">Select...</option>
                          {cat.sub_items.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[var(--text-muted)]">&mdash;</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                        className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--error-text)]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No rows parsed. Go back to edit your input.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rows.some((r) => r.errors?.length) && (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          Please fix errors before saving. Rows with issues are highlighted.
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
          onClick={handleBackToEdit}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        >
          Back to Edit
        </button>
        <button
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>
    </div>
  );
}
