"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Event } from "@/lib/queries/events";

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

export default function WeeklyDigestPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDigest() {
      try {
        const res = await fetch("/api/calendar-intel/digest");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setEvents(data.upcoming_events || []);
      } catch {
        setError("Failed to load weekly digest");
      } finally {
        setLoading(false);
      }
    }
    fetchDigest();
  }, []);

  async function handleConfirm(eventId: string, eventType: string) {
    try {
      const res = await fetch(`/api/calendar-intel/confirm/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType }),
      });
      if (!res.ok) throw new Error("Failed to confirm");
      // Remove from list after confirming
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      setError("Failed to confirm event");
    }
  }

  async function handleDismiss(eventId: string) {
    if (!confirm("Dismiss this event? It will be deleted.")) return;
    try {
      const res = await fetch(`/api/calendar-intel/dismiss/${eventId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      setError("Failed to dismiss event");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading digest...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <div className="mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-3 text-sm text-[var(--interactive)] hover:underline"
        >
          &larr; Back to Calendar
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Weekly Digest
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upcoming events for the next 7 days
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No upcoming events this week.
          </p>
          <Link
            href="/calendar/event"
            className="mt-2 inline-block text-sm font-medium text-[var(--interactive)] hover:underline"
          >
            Add an event &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/calendar/event/${event.id}`}
                    className="font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {event.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other
                      }`}
                    >
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(event.start_date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {event.location && (
                      <span className="text-xs text-[var(--text-muted)]">
                        &bull; {event.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleConfirm(event.id, event.event_type)}
                    className="rounded-lg border border-[var(--interactive)] px-3 py-1 text-xs font-medium text-[var(--interactive)] hover:bg-[var(--interactive-light)] transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleDismiss(event.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
