"use client";

import type { EventChecklistItem } from "@/lib/queries/event-checklists";

export default function ChecklistView({
  items,
  onToggle,
}: {
  items: EventChecklistItem[];
  onToggle: (itemId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] italic">
        No checklist items. Apply a template to add items.
      </p>
    );
  }

  const completed = items.filter((i) => i.is_completed).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          {completed}/{items.length} complete
        </span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full rounded-full bg-[var(--interactive)] transition-all"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isOverdue =
            !item.is_completed &&
            item.due_date &&
            item.due_date.split("T")[0] < new Date().toISOString().split("T")[0];

          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  item.is_completed
                    ? "border-[var(--interactive)] bg-[var(--interactive)] text-white"
                    : "border-[var(--input-border)] bg-[var(--input-bg)]"
                }`}
              >
                {item.is_completed && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    item.is_completed
                      ? "text-[var(--text-muted)] line-through"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {item.title}
                </p>
                {item.due_date && (
                  <p
                    className={`text-xs ${
                      isOverdue
                        ? "text-[var(--error-text)] font-medium"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    Due: {new Date(String(item.due_date).split("T")[0] + "T12:00:00").toLocaleDateString()}
                    {isOverdue && " (overdue)"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
