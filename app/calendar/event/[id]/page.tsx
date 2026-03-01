"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import ChecklistView from "@/components/calendar/ChecklistView";
import type { Event } from "@/lib/queries/events";
import type { EventChecklistItem } from "@/lib/queries/event-checklists";
import type { ChecklistTemplate } from "@/lib/queries/checklist-templates";
import type { EventAttachment } from "@/lib/queries/event-attachments";

const EVENT_TYPE_LABELS: Record<string, string> = {
  show: "Show",
  vet: "Vet Visit",
  farrier: "Farrier",
  lesson: "Lesson",
  pony_club: "Pony Club",
  clinic: "Clinic",
  ride: "Ride",
  other: "Other",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  show: "bg-[var(--interactive-light)] text-[var(--interactive)]",
  vet: "bg-[var(--error-bg)] text-[var(--error-text)]",
  farrier: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  lesson: "bg-[var(--success-bg)] text-[var(--accent-blue)]",
  pony_club: "bg-[var(--success-bg)] text-[var(--success-text)]",
  clinic: "bg-[var(--interactive-light)] text-[var(--accent-teal)]",
  ride: "bg-[var(--success-bg)] text-[var(--success-text)]",
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
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "pull_success" | "not_configured">("idle");

  const fetchData = useCallback(async () => {
    try {
      const [eventRes, checklistRes, templatesRes, attachmentsRes] = await Promise.all([
        fetch(`/api/events/${id}`),
        fetch(`/api/events/${id}/checklist`),
        fetch("/api/templates"),
        fetch(`/api/events/${id}/attachments`),
      ]);

      if (!eventRes.ok) throw new Error("Event not found");
      setEvent(await eventRes.json());
      if (checklistRes.ok) setChecklist(await checklistRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (attachmentsRes.ok) setAttachments(await attachmentsRes.json());
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
      const res = await fetch("/api/sync/reminders", {
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
      const res = await fetch("/api/sync/reminders/pull", { method: "POST" });
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
    const isParent = event?.recurrence_rule && !event.is_recurring_instance;
    const message = isParent
      ? "Delete this event and all future recurring instances? This cannot be undone."
      : "Delete this event? This cannot be undone.";
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/calendar");
    } catch {
      setError("Failed to delete event");
    }
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/events/${id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload");
      const attachment = await res.json();
      setAttachments((prev) => [...prev, attachment]);
    } catch {
      setError("Failed to upload attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!confirm("Delete this attachment?")) return;
    try {
      const res = await fetch(`/api/events/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError("Failed to delete attachment");
    }
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith("image/");
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other
                }`}
              >
                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
              </span>
              {(event.recurrence_rule || event.is_recurring_instance) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                  {event.recurrence_rule
                    ? event.recurrence_rule.charAt(0).toUpperCase() + event.recurrence_rule.slice(1)
                    : "Recurring"}
                </span>
              )}
            </div>
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

      {/* Attachments */}
      <div className="mt-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Attachments
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-[var(--interactive)] px-3 py-1.5 text-xs font-medium text-[var(--interactive)] hover:bg-[var(--interactive-light)] disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadAttachment}
          />
        </div>

        {attachments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No attachments yet.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--surface-muted)] p-2"
              >
                {isImage(att.mime_type) ? (
                  <a
                    href={`/uploads/event-attachments/${att.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={`/uploads/event-attachments/${att.filename}`}
                      alt={att.original_name}
                      className="h-12 w-12 rounded object-cover border border-[var(--border-light)]"
                    />
                  </a>
                ) : (
                  <a
                    href={`/uploads/event-attachments/${att.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[var(--border-light)] bg-[var(--surface)] text-xs font-medium text-[var(--text-muted)]"
                  >
                    {att.mime_type === "application/pdf" ? "PDF" : "FILE"}
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={`/uploads/event-attachments/${att.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-[var(--interactive)] hover:underline"
                  >
                    {att.original_name}
                  </a>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatFileSize(att.size_bytes)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteAttachment(att.id)}
                  className="shrink-0 rounded p-1 text-xs text-[var(--error-text)] hover:bg-[var(--error-bg)] transition-colors"
                  title="Delete attachment"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Push to Reminders */}
      <div className="mt-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Reminders
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {event.reminder_uid
                ? "Synced to iCloud Reminders"
                : "Push this event and checklist to iCloud Reminders"}
            </p>
          </div>
          <div className="flex gap-2">
            {event.reminder_uid && (
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
                : event.reminder_uid
                ? "Re-sync"
                : "Push to Reminders"}
            </button>
          </div>
        </div>
        {syncStatus === "success" && (
          <p className="mt-2 text-xs text-[var(--success-text)]">
            Successfully synced to iCloud Reminders!
          </p>
        )}
        {syncStatus === "pull_success" && (
          <p className="mt-2 text-xs text-[var(--success-text)]">
            Checklist status updated from iCloud Reminders.
          </p>
        )}
        {syncStatus === "not_configured" && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Select an Event checklists list in Settings &gt; Integrations.
          </p>
        )}
      </div>
    </div>
  );
}
