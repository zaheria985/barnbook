"use client";

import { useState, useEffect, useCallback } from "react";
import type { IncomeSource } from "@/lib/queries/income";

export default function IncomeSourceManager() {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/income/sources");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSources(data);
    } catch {
      setError("Failed to load income sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/income/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setNewName("");
      setShowAdd(false);
      await fetchSources();
    } catch {
      setError("Failed to create income source");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/income/sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      await fetchSources();
    } catch {
      setError("Failed to update income source");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete income source "${name}"?`)) return;
    try {
      const res = await fetch(`/api/income/sources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchSources();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete income source"
      );
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const idx = sources.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sources.length) return;

    const currentOrder = sources[idx].sort_order;
    const swapOrder = sources[swapIdx].sort_order;

    try {
      await Promise.all([
        fetch(`/api/income/sources/${sources[idx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: swapOrder }),
        }),
        fetch(`/api/income/sources/${sources[swapIdx].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: currentOrder }),
        }),
      ]);
      await fetchSources();
    } catch {
      setError("Failed to reorder");
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-sm text-[var(--text-muted)]">
        Loading income sources...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Income Sources
        </h2>
        <button
          onClick={() => {
            setShowAdd(true);
            setNewName("");
          }}
          className="rounded-lg bg-[var(--interactive)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + Add Source
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-2 text-sm text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-3 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] p-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Salary, Horse Sales"
              autoFocus
              className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
            >
              {adding ? "..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sources.length === 0 && !showAdd ? (
        <p className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
          No income sources yet. Add one to start tracking income.
        </p>
      ) : (
        <div className="space-y-1">
          {sources.map((source, idx) => (
            <div
              key={source.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleReorder(source.id, "up")}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                </button>
                <button
                  onClick={() => handleReorder(source.id, "down")}
                  disabled={idx === sources.length - 1}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
              </div>

              {editingId === source.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(source.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                  />
                  <button
                    onClick={() => handleUpdate(source.id)}
                    className="text-sm text-[var(--interactive)] hover:underline"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-[var(--text-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-medium text-[var(--text-primary)]">
                    {source.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(source.id);
                      setEditName(source.name);
                    }}
                    className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(source.id, source.name)}
                    className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
