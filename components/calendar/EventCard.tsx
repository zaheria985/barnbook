"use client";

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
  show: "bg-purple-100 text-purple-700",
  vet: "bg-red-100 text-red-700",
  farrier: "bg-amber-100 text-amber-700",
  lesson: "bg-blue-100 text-blue-700",
  pony_club: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

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
        {event.location && (
          <p className="truncate text-xs text-[var(--text-muted)]">
            {event.location}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          EVENT_TYPE_BADGE[event.event_type] || EVENT_TYPE_BADGE.other
        }`}
      >
        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
      </span>
    </Link>
  );
}
