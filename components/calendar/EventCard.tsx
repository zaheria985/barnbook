"use client";

import Link from "next/link";
import type { Event } from "@/lib/queries/events";

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

function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === "00" ? `${display} ${suffix}` : `${display}:${m} ${suffix}`;
}

export default function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/calendar/event/${event.id}`}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm text-[var(--text-primary)]">
          {event.title}
        </p>
        {event.start_time && event.end_time && (
          <p className="text-xs text-[var(--text-muted)]">
            {formatTime12h(event.start_time)} &ndash; {formatTime12h(event.end_time)}
          </p>
        )}
        {event.location && (
          <p className="truncate text-xs text-[var(--text-muted)]">
            {event.location}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {(event.is_recurring_instance || event.recurrence_rule) && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--text-muted)]"
            aria-label="Recurring event"
          >
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other
          }`}
        >
          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
        </span>
      </div>
    </Link>
  );
}
