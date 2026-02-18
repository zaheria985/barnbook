"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { BudgetCategory } from "@/lib/queries/budget-categories";

interface RowData {
  id: string;
  date: string;
  dateDefaulted: boolean;
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
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u00AD]/g, "")  // strip zero-width/invisible
    .replace(/[\u00A0\u2007\u202F\u2009\u200A\u205F\u3000]/g, " ")  // unicode spaces → space
    .replace(/[\u2044\u2215\uFF0F]/g, "/")        // unicode slashes → /
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFF0D]/g, "-")  // unicode dashes → -
    .replace(/[\uFF0E]/g, ".")                     // fullwidth period → .
    .replace(/\r\n/g, "\n")                        // Windows line endings
    .replace(/\r/g, "\n");                          // old Mac line endings
}

function parseDate(raw: string): string | null {
  const input = normalizeText(raw).trim();
  if (!input) return null;

  const formats: { pattern: RegExp; extract: (m: RegExpMatchArray) => string }[] = [
    { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, extract: (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` },
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, extract: (m) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
    { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, extract: (m) => { const y = parseInt(m[3]); return `${y < 50 ? 2000 + y : 1900 + y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; } },
    { pattern: /^(\d{1,2})\/(\d{1,2})$/, extract: (m) => `${new Date().getFullYear()}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
    { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, extract: (m) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
    { pattern: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, extract: (m) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
  ];

  for (const fmt of formats) {
    const match = input.match(fmt.pattern);
    if (match) return fmt.extract(match);
  }
  return null;
}

function parseRows(text: string, categories: BudgetCategory[]): RowData[] {
  const normalized = normalizeText(text);
  const lines = normalized.trim().split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  const today = new Date().toISOString().split("T")[0];

  return lines.map((line) => {
    const parts = line.split(" / ").map((p) => p.trim());
    const [rawDate, vendor, rawAmount, categoryName] = parts;

    const date = parseDate(rawDate || "");
    const dateDefaulted = !date;

    let categoryId = "";
    let subItemId = "";
    let notesValue = "";
    const matchedCat = categoryName
      ? categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
      : undefined;

    if (matchedCat) {
      categoryId = matchedCat.id;
      if (parts.length >= 6) {
        const subItemName = parts[4];
        const sub = matchedCat.sub_items.find(
          (s) => s.label.toLowerCase() === subItemName.toLowerCase()
        );
        if (sub) subItemId = sub.id;
        notesValue = parts.slice(5).join(" / ");
      } else if (parts.length === 5) {
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
      if (parts.length >= 5) notesValue = parts.slice(4).join(" / ");
    }

    const errors: string[] = [];
    if (dateDefaulted) errors.push("Date defaulted to today");
    if (!rawAmount || isNaN(Number(rawAmount))) errors.push("Invalid amount");
    if (!vendor) errors.push("Vendor required");

    return {
      id: generateId(),
      date: date || today,
      dateDefaulted,
      category_id: categoryId,
      sub_item_id: subItemId,
      vendor: vendor || "",
      amount: rawAmount || "",
      notes: notesValue,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

export default function BulkPasteEntry({ categories, onSave }: BulkPasteEntryProps) {
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [saveResults, setSaveResults] = useState<{ success: boolean; error?: string }[] | null>(null);
  const vendorMatchedRef = useRef(new Set<string>());

  const categoryMap = useMemo(() => {
    const map = new Map<string, BudgetCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const validRows = useMemo(
    () => rows.filter((r) => {
      const fatal = r.errors?.filter((e) => e !== "Date defaulted to today") ?? [];
      return fatal.length === 0 && r.date && r.amount;
    }),
    [rows]
  );

  // Debounced vendor matching after text changes
  useEffect(() => {
    if (rows.length === 0) return;

    const vendors = new Set(
      rows
        .filter((r) => r.vendor && !r.category_id && !vendorMatchedRef.current.has(r.vendor))
        .map((r) => r.vendor)
    );
    if (vendors.size === 0) return;

    const timer = setTimeout(async () => {
      setMatching(true);
      const vendorMatches = new Map<string, { category_id: string; sub_item_id: string | null }>();

      try {
        await Promise.all(
          Array.from(vendors).map(async (v) => {
            vendorMatchedRef.current.add(v);
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
    }, 500);

    return () => clearTimeout(timer);
  }, [rows]);

  function updateRawAndRows(nextRaw: string) {
    setRawText(nextRaw);
    setRows(parseRows(nextRaw, categories));
    setSaveResults(null);
    vendorMatchedRef.current.clear();
  }

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
        setRawText("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Textarea input */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-6">
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
          Expense rows
        </label>
        <textarea
          value={rawText}
          onChange={(e) => updateRawAndRows(e.target.value)}
          placeholder={
            "Paste expenses one per line:\n\n" +
            "02/15/2025 / Tractor Supply / 45.99 / Feed / Hay Delivery / grain order\n" +
            "2/16 / Rural King / 23.50 / Supplies\n" +
            "02/17/25 / Vet Clinic / 150.00\n\n" +
            "Format: date / vendor / amount / category / sub-item / notes\n" +
            "Category, sub-item, and notes are optional.\n" +
            "Dates: M/D, M/D/YY, M/D/YYYY, or YYYY-MM-DD"
          }
          rows={10}
          className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--interactive)] focus:outline-none focus:ring-1 focus:ring-[var(--interactive)]"
        />
      </div>

      {/* Preview table */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Preview</h2>
          <span className="text-sm text-[var(--text-muted)]">
            {validRows.length} valid / {rows.length} total
            {matching && " · matching vendors..."}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Paste rows above to preview before saving.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border-light)] bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Sub-Item</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Validation</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {rows.map((row) => {
                  const cat = categoryMap.get(row.category_id);
                  const fatalErrors = row.errors?.filter((e) => e !== "Date defaulted to today") ?? [];
                  return (
                    <tr
                      key={row.id}
                      className={fatalErrors.length ? "bg-[var(--error-bg)]" : ""}
                    >
                      <td className="px-2 py-2 align-top">
                        <input
                          type="text"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, { date: e.target.value, dateDefaulted: false })}
                          placeholder="YYYY-MM-DD"
                          className={`w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm ${
                            row.dateDefaulted
                              ? "text-amber-600 italic dark:text-amber-400"
                              : "text-[var(--input-text)]"
                          }`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          type="text"
                          value={row.vendor}
                          onChange={(e) => updateRow(row.id, { vendor: e.target.value })}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)]"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
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
                      <td className="px-2 py-2 align-top">
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
                      <td className="px-2 py-2 align-top">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                          className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 align-top text-xs">
                        {fatalErrors.length > 0 ? (
                          <span className="font-medium text-[var(--error-text)]">
                            {fatalErrors.join(", ")}
                          </span>
                        ) : row.dateDefaulted ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            Date defaulted
                          </span>
                        ) : (
                          <span className="text-[var(--success-text)]">OK</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
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
              </tbody>
            </table>
          </div>
        )}

        {saveResults && (
          <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${saveResults.every((r) => r.success) ? "border-[var(--success-solid)] bg-[var(--success-bg)] text-[var(--success-text)]" : "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]"}`}>
            {saveResults.every((r) => r.success)
              ? `Saved ${saveResults.length} expenses successfully!`
              : `Some rows failed: ${saveResults.filter((r) => !r.success).length} errors`}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={saving || validRows.length === 0}
            className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save All (${validRows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
