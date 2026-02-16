"use client";

import { useState, useEffect, useCallback } from "react";
import type { DetectionKeyword } from "@/lib/queries/detection-keywords";

const EVENT_TYPES = [
  { value: "show", label: "Show" },
  { value: "vet", label: "Vet Visit" },
  { value: "farrier", label: "Farrier" },
  { value: "lesson", label: "Lesson" },
  { value: "pony_club", label: "Pony Club" },
  { value: "other", label: "Other" },
];

export default function KeywordsSettingsPage() {
  const [keywords, setKeywords] = useState<DetectionKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newKeyword, setNewKeyword] = useState("");
  const [newType, setNewType] = useState("show");
  const [adding, setAdding] = useState(false);

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-intel/keywords");
      if (!res.ok) throw new Error("Failed to fetch");
      setKeywords(await res.json());
    } catch {
      setError("Failed to load keywords");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setAdding(true);

    try {
      const res = await fetch("/api/calendar-intel/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          suggested_event_type: newType,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setNewKeyword("");
      await fetchKeywords();
    } catch {
      setError("Failed to add keyword");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/calendar-intel/keywords/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setError("Failed to delete keyword");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Calendar Intelligence Keywords
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Keywords used to detect horse-related events from emails and calendars
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mb-4 flex gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-3"
      >
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="New keyword..."
          className="flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || !newKeyword.trim()}
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </form>

      {/* List */}
      {keywords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No keywords configured.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-[var(--text-primary)]">
                  {kw.keyword}
                </span>
                <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {EVENT_TYPES.find((t) => t.value === kw.suggested_event_type)?.label || kw.suggested_event_type}
                </span>
              </div>
              <button
                onClick={() => handleDelete(kw.id)}
                className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
