"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Event } from "@/lib/queries/events";
import type { SuggestedWindow } from "@/lib/queries/icloud-sync";

const EVENT_TYPE_LABELS: Record<string, string> = {
  show: "Show",
  vet: "Vet Visit",
  farrier: "Farrier",
  lesson: "Lesson",
  pony_club: "Pony Club",
  ride: "Ride",
  other: "Other",
};

const EVENT_TYPE_BADGE: Record<string, string> = {
  show: "bg-[var(--interactive-light)] text-[var(--interactive)]",
  vet: "bg-[var(--error-bg)] text-[var(--error-text)]",
  farrier: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  lesson: "bg-[var(--success-bg)] text-[var(--accent-blue)]",
  pony_club: "bg-[var(--success-bg)] text-[var(--success-text)]",
  ride: "bg-[var(--success-bg)] text-[var(--success-text)]",
  other: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
};

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string | null;
  location: string | null;
}

interface DigestData {
  upcoming_events: Event[];
  confirmed_events: Event[];
  suggested_windows: SuggestedWindow[];
  ical_events: ICalEvent[];
}

// A unified timeline item for sorting within a day
type TimelineItem =
  | { kind: "ical"; data: ICalEvent; sortTime: number }
  | { kind: "confirmed"; data: Event; sortTime: number }
  | { kind: "unconfirmed"; data: Event; sortTime: number }
  | { kind: "window"; data: SuggestedWindow; sortTime: number };

interface DayBucket {
  dateStr: string; // YYYY-MM-DD
  items: TimelineItem[];
  bestScore: string | null; // best weather score for this day's windows
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === "00" ? `${display} ${suffix}` : `${display}:${m} ${suffix}`;
}

function scoreColor(score: string): string {
  if (score === "green") return "bg-[var(--success-text)]";
  if (score === "yellow") return "bg-[var(--warning-text)]";
  return "bg-[var(--error-text)]";
}

function scoreBorderColor(score: string): string {
  if (score === "green") return "border-[var(--success-text)]";
  if (score === "yellow") return "border-[var(--warning-text)]";
  return "border-[var(--error-text)]";
}

/** Parse a date string to YYYY-MM-DD, handling postgres ISO and iCal formats */
function toDateKey(dateStr: string): string {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // ISO with T: "2026-02-22T00:00:00.000Z" or "2026-02-22T14:30:00Z"
  if (dateStr.includes("T")) return dateStr.split("T")[0];
  return dateStr;
}

/** Get a sort-friendly time value (minutes from midnight) from various formats */
function parseSortTime(timeStr: string | null, dateStr: string): number {
  if (timeStr) {
    // HH:MM or HH:MM:SS
    const parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  // Try to extract time from ISO datetime
  if (dateStr.includes("T")) {
    const timePart = dateStr.split("T")[1];
    if (timePart) {
      const parts = timePart.replace("Z", "").split(":");
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }
  }
  // All-day event, sort at start of day
  return 0;
}

/** Format a datetime/date string into a display time, or "All day" */
function displayTimeFromIcal(dtstart: string): string {
  // Pure date (no time component): "2026-02-22"
  if (/^\d{4}-\d{2}-\d{2}$/.test(dtstart)) return "All day";
  if (dtstart.includes("T")) {
    const timePart = dtstart.split("T")[1];
    if (timePart) {
      const hhmm = timePart.replace("Z", "").substring(0, 5); // "14:30"
      return formatTime12h(hhmm);
    }
  }
  return "All day";
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function WeeklyDigestPage() {
  const [unconfirmedEvents, setUnconfirmedEvents] = useState<Event[]>([]);
  const [confirmedEvents, setConfirmedEvents] = useState<Event[]>([]);
  const [windows, setWindows] = useState<SuggestedWindow[]>([]);
  const [icalEvents, setIcalEvents] = useState<ICalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDigest() {
      try {
        const res = await fetch("/api/calendar-intel/digest");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: DigestData = await res.json();
        setUnconfirmedEvents(data.upcoming_events || []);
        setConfirmedEvents(data.confirmed_events || []);
        setWindows(data.suggested_windows || []);
        setIcalEvents(data.ical_events || []);
      } catch {
        setError("Failed to load weekly digest");
      } finally {
        setLoading(false);
      }
    }
    fetchDigest();
  }, []);

  // Compute the 7-day cutoff
  const sevenDayCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Build day buckets for the 7-day timeline
  const { timelineDays, comingUpEvents } = useMemo(() => {
    const dayMap = new Map<string, TimelineItem[]>();

    // Helper to add items to day map
    function addItem(dateKey: string, item: TimelineItem) {
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(item);
    }

    // iCal events (7-day window only, already filtered by API)
    for (const ev of icalEvents) {
      const dateKey = toDateKey(ev.dtstart);
      if (dateKey >= today && dateKey < sevenDayCutoff) {
        addItem(dateKey, {
          kind: "ical",
          data: ev,
          sortTime: parseSortTime(null, ev.dtstart),
        });
      }
    }

    // Confirmed events - split into 7-day and beyond
    const comingUp: Event[] = [];
    for (const ev of confirmedEvents) {
      const dateKey = toDateKey(String(ev.start_date));
      if (dateKey >= today && dateKey < sevenDayCutoff) {
        addItem(dateKey, {
          kind: "confirmed",
          data: ev,
          sortTime: parseSortTime(ev.start_time, String(ev.start_date)),
        });
      } else if (dateKey >= sevenDayCutoff) {
        comingUp.push(ev);
      }
    }

    // Unconfirmed events - split into 7-day and beyond
    for (const ev of unconfirmedEvents) {
      const dateKey = toDateKey(String(ev.start_date));
      if (dateKey >= today && dateKey < sevenDayCutoff) {
        addItem(dateKey, {
          kind: "unconfirmed",
          data: ev,
          sortTime: parseSortTime(ev.start_time, String(ev.start_date)),
        });
      } else if (dateKey >= sevenDayCutoff) {
        comingUp.push(ev);
      }
    }

    // Suggested ride windows (within 7-day window)
    for (const w of windows) {
      const dateKey = toDateKey(String(w.date));
      if (dateKey >= today && dateKey < sevenDayCutoff) {
        addItem(dateKey, {
          kind: "window",
          data: w,
          sortTime: parseSortTime(w.start_time, String(w.date)),
        });
      }
    }

    // Sort each day's items by time
    for (const items of dayMap.values()) {
      items.sort((a, b) => a.sortTime - b.sortTime);
    }

    // Build ordered array of day buckets
    const sortedDates = Array.from(dayMap.keys()).sort();
    const days: DayBucket[] = sortedDates.map((dateStr) => {
      const items = dayMap.get(dateStr)!;
      // Find best weather score from windows on this day
      const dayWindows = items.filter((i) => i.kind === "window") as Extract<TimelineItem, { kind: "window" }>[];
      let bestScore: string | null = null;
      if (dayWindows.length > 0) {
        if (dayWindows.some((w) => w.data.weather_score === "green")) bestScore = "green";
        else if (dayWindows.some((w) => w.data.weather_score === "yellow")) bestScore = "yellow";
        else bestScore = dayWindows[0].data.weather_score;
      }
      return { dateStr, items, bestScore };
    });

    // Sort coming-up events by date
    comingUp.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

    return { timelineDays: days, comingUpEvents: comingUp };
  }, [icalEvents, confirmedEvents, unconfirmedEvents, windows, today, sevenDayCutoff]);

  // --- Handlers (unchanged logic) ---

  async function handleConfirm(eventId: string, eventType: string) {
    try {
      const res = await fetch(`/api/calendar-intel/confirm/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType }),
      });
      if (!res.ok) throw new Error("Failed to confirm");
      setUnconfirmedEvents((prev) => prev.filter((e) => e.id !== eventId));
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
      setUnconfirmedEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      setError("Failed to dismiss event");
    }
  }

  async function handleApproveWindow(windowId: string) {
    try {
      const res = await fetch(`/api/calendar-intel/ride-window/${windowId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve");
      setWindows((prev) => prev.filter((w) => w.id !== windowId));
    } catch {
      setError("Failed to approve ride window");
    }
  }

  async function handleDismissWindow(windowId: string) {
    try {
      const res = await fetch(`/api/calendar-intel/ride-window/${windowId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      setWindows((prev) => prev.filter((w) => w.id !== windowId));
    } catch {
      setError("Failed to dismiss ride window");
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading digest...
      </div>
    );
  }

  const hasTimelineContent = timelineDays.length > 0;
  const hasComingUp = comingUpEvents.length > 0;
  const isEmpty = !hasTimelineContent && !hasComingUp;

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/calendar"
          className="mb-3 inline-block text-sm text-[var(--interactive)] hover:underline"
        >
          &larr; Back to Calendar
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Your Week at a Glance
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Day-by-day view of your schedule and ride opportunities
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No upcoming events or ride opportunities this week.
          </p>
          <Link
            href="/calendar/event"
            className="mt-2 inline-block text-sm font-medium text-[var(--interactive)] hover:underline"
          >
            Add an event &rarr;
          </Link>
        </div>
      )}

      {/* 7-day timeline */}
      {hasTimelineContent && (
        <div className="space-y-4">
          {timelineDays.map((day) => (
            <div
              key={day.dateStr}
              className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] overflow-hidden"
            >
              {/* Day header */}
              <div className="flex items-center gap-2 border-b border-[var(--border-light)] px-4 py-3">
                {day.bestScore && (
                  <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${scoreColor(day.bestScore)}`} />
                )}
                <h2 className="font-semibold text-[var(--text-primary)]">
                  {formatDayHeader(day.dateStr)}
                </h2>
              </div>

              {/* Day items */}
              <div className="divide-y divide-[var(--border-light)]">
                {day.items.map((item) => {
                  switch (item.kind) {
                    case "ical":
                      return (
                        <ICalEventRow key={`ical-${item.data.uid}`} event={item.data} />
                      );
                    case "confirmed":
                      return (
                        <ConfirmedEventRow key={`confirmed-${item.data.id}`} event={item.data} />
                      );
                    case "unconfirmed":
                      return (
                        <UnconfirmedEventRow
                          key={`unconfirmed-${item.data.id}`}
                          event={item.data}
                          onConfirm={handleConfirm}
                          onDismiss={handleDismiss}
                        />
                      );
                    case "window":
                      return (
                        <RideWindowRow
                          key={`window-${item.data.id}`}
                          window={item.data}
                          onApprove={handleApproveWindow}
                          onDismiss={handleDismissWindow}
                        />
                      );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coming Up section (beyond 7 days) */}
      {hasComingUp && (
        <div className={hasTimelineContent ? "mt-8" : ""}>
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            Coming Up
          </h2>
          <div className="space-y-3">
            {comingUpEvents.map((event) => (
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
                        {formatShortDate(toDateKey(String(event.start_date)))}
                      </span>
                      {event.location && (
                        <span className="text-xs text-[var(--text-muted)]">
                          &bull; {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {!event.is_confirmed && (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Row components ---

function ICalEventRow({ event }: { event: ICalEvent }) {
  const timeDisplay = displayTimeFromIcal(event.dtstart);

  return (
    <div className="flex items-center gap-3 border-l-4 border-[var(--border)] px-4 py-3">
      <div className="w-16 shrink-0 text-xs text-[var(--text-muted)]">
        {timeDisplay}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--text-muted)]">{event.summary}</span>
        {event.location && (
          <span className="ml-2 text-xs text-[var(--text-muted)] opacity-70">
            &bull; {event.location}
          </span>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
        iCloud
      </span>
    </div>
  );
}

function ConfirmedEventRow({ event }: { event: Event }) {
  const timeDisplay = event.start_time ? formatTime12h(event.start_time) : "All day";
  const badgeClass = EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other;

  return (
    <div className="flex items-center gap-3 border-l-4 border-[var(--success-text)] px-4 py-3">
      <div className="w-16 shrink-0 text-xs text-[var(--text-muted)]">
        {timeDisplay}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/calendar/event/${event.id}`}
          className="text-sm font-medium text-[var(--text-primary)] hover:underline"
        >
          {event.title}
        </Link>
        {event.location && (
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            &bull; {event.location}
          </span>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
      </span>
    </div>
  );
}

function UnconfirmedEventRow({
  event,
  onConfirm,
  onDismiss,
}: {
  event: Event;
  onConfirm: (id: string, type: string) => void;
  onDismiss: (id: string) => void;
}) {
  const timeDisplay = event.start_time ? formatTime12h(event.start_time) : "All day";
  const badgeClass = EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other;

  return (
    <div className="flex items-start gap-3 border-l-4 border-[var(--interactive)] px-4 py-3">
      <div className="w-16 shrink-0 pt-0.5 text-xs text-[var(--text-muted)]">
        {timeDisplay}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar/event/${event.id}`}
            className="text-sm font-medium text-[var(--text-primary)] hover:underline"
          >
            {event.title}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
          </span>
        </div>
        {event.location && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{event.location}</p>
        )}
        <div className="mt-2 flex gap-1">
          <button
            onClick={() => onConfirm(event.id, event.event_type)}
            className="rounded-lg border border-[var(--interactive)] px-3 py-1 text-xs font-medium text-[var(--interactive)] hover:bg-[var(--interactive-light)] transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => onDismiss(event.id)}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function RideWindowRow({
  window: w,
  onApprove,
  onDismiss,
}: {
  window: SuggestedWindow;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className={`flex items-start gap-3 border-l-4 border-dashed ${scoreBorderColor(w.weather_score)} px-4 py-3`}>
      <div className="w-16 shrink-0 pt-0.5 text-xs text-[var(--text-muted)]">
        {formatTime12h(w.start_time)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${scoreColor(w.weather_score)}`} />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {formatTime12h(w.start_time)} &ndash; {formatTime12h(w.end_time)}
          </span>
        </div>
        {w.weather_notes.length > 0 && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {w.weather_notes[0]}
          </p>
        )}
        <div className="mt-2 flex gap-1">
          <button
            onClick={() => onApprove(w.id)}
            className="rounded-lg border border-[var(--interactive)] px-3 py-1 text-xs font-medium text-[var(--interactive)] hover:bg-[var(--interactive-light)] transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onDismiss(w.id)}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
