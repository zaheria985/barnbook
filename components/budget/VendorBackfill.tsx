"use client";

import { useState, useEffect, useCallback } from "react";
import TagPicker from "@/components/ui/TagPicker";
import type { VendorlessExpense } from "@/lib/queries/expenses";

interface VendorTag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_sub_item_id: string | null;
}

interface Group {
  key: string;
  category_name: string;
  notes: string | null;
  expenses: VendorlessExpense[];
  total: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

/**
 * One-time cleanup tool: assign vendors to expenses that were imported
 * without one. Groups by (category, notes) so a whole import batch can be
 * fixed with one pick. Closed-month rows are skipped and reported, not
 * treated as failures.
 */
export default function VendorBackfill({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [expenses, setExpenses] = useState<VendorlessExpense[]>([]);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<string, VendorTag[]>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const fetchVendorless = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses?vendorless=1");
      if (res.ok) setExpenses(await res.json());
    } catch {
      // non-fatal; the card just doesn't render
    }
  }, []);

  useEffect(() => {
    fetchVendorless();
  }, [fetchVendorless]);

  if (expenses.length === 0) return null;

  const groups = new Map<string, Group>();
  for (const e of expenses) {
    const key = `${e.category_name}|${e.notes ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        category_name: e.category_name,
        notes: e.notes,
        expenses: [],
        total: 0,
      };
      groups.set(key, g);
    }
    g.expenses.push(e);
    g.total += e.amount;
  }
  const groupList = Array.from(groups.values());

  async function applyGroup(group: Group) {
    const tag = picks[group.key]?.[0];
    if (!tag) return;
    setApplying(group.key);
    setStatus("");
    let updated = 0;
    let skippedClosed = 0;
    let failed = 0;
    // Sequential PUTs — group sizes are small and this keeps error handling simple.
    for (const exp of group.expenses) {
      try {
        const res = await fetch(`/api/expenses/${exp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendor: tag.name }),
        });
        if (res.ok) updated++;
        else if (res.status === 403) skippedClosed++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setApplying(null);
    const parts = [`${updated} updated`];
    if (skippedClosed > 0) parts.push(`${skippedClosed} in closed months skipped`);
    if (failed > 0) parts.push(`${failed} failed`);
    setStatus(parts.join(", "));
    await fetchVendorless();
    onChanged?.();
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-[var(--warning-text)]">
          Assign vendors — {expenses.length} expense
          {expenses.length === 1 ? "" : "s"} missing one
        </span>
        <span aria-hidden="true" className="text-[var(--warning-text)]">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {status && (
            <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              {status}
            </p>
          )}
          {groupList.map((group) => (
            <div
              key={group.key}
              className="rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-3"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                  {group.category_name}
                  {group.notes && (
                    <span className="font-normal text-[var(--text-muted)]">
                      {" "}
                      &middot; {group.notes}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {group.expenses.length} &middot; {formatCurrency(group.total)}
                </span>
              </div>
              <p className="mb-2 text-xs text-[var(--text-muted)]">
                {group.expenses
                  .slice(0, 4)
                  .map((e) => formatDate(e.date))
                  .join(", ")}
                {group.expenses.length > 4 && ", …"}
              </p>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <TagPicker
                    tagType="vendor"
                    selected={picks[group.key] || []}
                    onChange={(tags: VendorTag[]) =>
                      setPicks((p) => ({ ...p, [group.key]: tags }))
                    }
                    singleSelect
                    allowCreate
                    placeholder="Pick or create a vendor"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => applyGroup(group)}
                  disabled={!picks[group.key]?.[0] || applying === group.key}
                  className="shrink-0 rounded-lg bg-[var(--interactive)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50"
                >
                  {applying === group.key ? "Applying..." : "Apply"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
