"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import ChecklistView from "@/components/calendar/ChecklistView";
import type { Event } from "@/lib/queries/events";
import type { EventChecklistItem } from "@/lib/queries/event-checklists";
import type { ChecklistTemplate } from "@/lib/queries/checklist-templates";

const EVENT_TYPE_LABELS: Record<string, string> = {
  show: "Show",
  vet: "Vet Visit",
  farrier: "Farrier",
  lesson: "Lesson",
  pony_club: "Pony Club",
  other: "Other",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  show: "bg-[var(--interactive-light)] text-[var(--interactive)]",
  vet: "bg-[var(--error-bg)] text-[var(--error-text)]",
  farrier: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  lesson: "bg-[var(--success-bg)] text-[var(--accent-blue)]",
  pony_club: "bg-[var(--success-bg)] text-[var(--success-text)]",
  other: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [checklist, setChecklist] = useState<EventChecklistItem[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "pull_success" | "not_configured">("idle");

  const fetchData = useCallback(async () => {
    try {
      const [eventRes, checklistRes, templatesRes] = await Promise.all([
        fetch(`/api/events/${id}`),
        fetch(`/api/events/${id}/checklist`),
        fetch("/api/templates"),
      ]);

      if (!eventRes.ok) throw new Error("Event not found");
      setEvent(await eventRes.json());
      if (checklistRes.ok) setChecklist(await checklistRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
    } catch {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggle(itemId: string) {
    try {
      const res = await fetch(`/api/events/${id}/checklist/${itemId}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to toggle");
      const updated = await res.json();
      setChecklist((prev) =>
        prev.map((i) => (i.id === itemId ? updated : i))
      );
    } catch {
      setError("Failed to update checklist item");
    }
  }

  async function handleApplyTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/events/${id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (!res.ok) throw new Error("Failed to apply template");
      const newItems = await res.json();
      setChecklist((prev) => [...prev, ...newItems]);
    } catch {
      setError("Failed to apply template");
    }
  }

  async function handlePushToReminders() {
    setSyncing(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/sync/vikunja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id }),
      });
      if (res.status === 503) {
        setSyncStatus("not_configured");
        return;
      }
      if (!res.ok) throw new Error("Failed to sync");
      setSyncStatus("success");
      await fetchData();
    } catch {
      setError("Failed to push to reminders");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePullFromReminders() {
    setPulling(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/sync/vikunja/pull", { method: "POST" });
      if (res.status === 503) {
        setSyncStatus("not_configured");
        return;
      }
      if (!res.ok) throw new Error("Failed to pull");
      setSyncStatus("pull_success");
      await fetchData();
    } catch {
      setError("Failed to pull from reminders");
    } finally {
      setPulling(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/calendar");
    } catch {
      setError("Failed to delete event");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading event...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Event not found
      </div>
    );
  }

  const matchingTemplates = templates.filter(
    (t) => t.event_type === event.event_type
  );

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/calendar")}
          className="mb-3 text-sm text-[var(--interactive)] hover:underline"
        >
          &larr; Back to Calendar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {event.title}
            </h1>
            <span
              className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other
              }`}
            >
              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
            </span>
          </div>
          <button
            onClick={handleDelete}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Event Details */}
      <div className="mb-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-[var(--text-muted)]">Start</span>
            <p className="font-medium text-[var(--text-primary)]">
              {new Date(String(event.start_date).split("T")[0] + "T12:00:00").toLocaleDateString()}
            </p>
          </div>
          {event.end_date && (
            <div>
              <span className="text-[var(--text-muted)]">End</span>
              <p className="font-medium text-[var(--text-primary)]">
                {new Date(String(event.end_date).split("T")[0] + "T12:00:00").toLocaleDateString()}
              </p>
            </div>
          )}
          {event.location && (
            <div className="col-span-2">
              <span className="text-[var(--text-muted)]">Location</span>
              <p className="font-medium text-[var(--text-primary)]">
                {event.location}
              </p>
            </div>
          )}
          {event.entry_due_date && (
            <div>
              <span className="text-[var(--text-muted)]">Entry Due</span>
              <p className="font-medium text-[var(--text-primary)]">
                {new Date(String(event.entry_due_date).split("T")[0] + "T12:00:00").toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
        {event.notes && (
          <div className="border-t border-[var(--border-light)] pt-3">
            <span className="text-sm text-[var(--text-muted)]">Notes</span>
            <p className="mt-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {event.notes}
            </p>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Checklist
          </h2>
          {checklist.length === 0 && matchingTemplates.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleApplyTemplate(e.target.value);
                e.target.value = "";
              }}
              className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--input-text)] focus:outline-none"
            >
              <option value="">Apply template...</option>
              {matchingTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <ChecklistView items={checklist} onToggle={handleToggle} />
      </div>

      {/* Push to Reminders */}
      <div className="mt-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Vikunja Sync
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {event.vikunja_task_id
                ? "Synced to Vikunja"
                : "Push this event and checklist to Vikunja/Apple Reminders"}
            </p>
          </div>
          <div className="flex gap-2">
            {event.vikunja_task_id && (
              <button
                onClick={handlePullFromReminders}
                disabled={pulling}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50 transition-colors"
              >
                {pulling ? "Checking..." : "Check Status"}
              </button>
            )}
            <button
              onClick={handlePushToReminders}
              disabled={syncing}
              className="rounded-lg border border-[var(--interactive)] px-4 py-2 text-sm font-medium text-[var(--interactive)] hover:bg-[var(--interactive-light)] disabled:opacity-50 transition-colors"
            >
              {syncing
                ? "Syncing..."
                : event.vikunja_task_id
                ? "Re-sync"
                : "Push to Reminders"}
            </button>
          </div>
        </div>
        {syncStatus === "success" && (
          <p className="mt-2 text-xs text-[var(--success-text)]">
            Successfully synced to Vikunja!
          </p>
        )}
        {syncStatus === "pull_success" && (
          <p className="mt-2 text-xs text-[var(--success-text)]">
            Checklist status updated from Vikunja.
          </p>
        )}
        {syncStatus === "not_configured" && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Vikunja is not configured. Set VIKUNJA_URL and VIKUNJA_API_TOKEN environment variables.
          </p>
        )}
      </div>
    </div>
  );
}
