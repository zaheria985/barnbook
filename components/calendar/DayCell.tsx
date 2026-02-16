"use client";

import type { Event } from "@/lib/queries/events";

const EVENT_TYPE_COLORS: Record<string, string> = {
  show: "bg-purple-400",
  vet: "bg-red-400",
  farrier: "bg-amber-400",
  lesson: "bg-blue-400",
  pony_club: "bg-green-400",
  other: "bg-gray-400",
};

const RIDE_SCORE_BORDER: Record<string, string> = {
  green: "border-l-2 border-l-green-400",
  yellow: "border-l-2 border-l-amber-400",
  red: "border-l-2 border-l-red-400",
};

export default function DayCell({
  date,
  day,
  events,
  isToday,
  isSelected,
  rideScore,
  onClick,
}: {
  date: string | null;
  day: number | null;
  events: Event[];
  isToday: boolean;
  isSelected: boolean;
  rideScore?: "green" | "yellow" | "red" | null;
  onClick?: () => void;
}) {
  if (!date || day === null) {
    return <div className="min-h-[72px] bg-[var(--surface-muted)] md:min-h-[90px]" />;
  }

  return (
    <button
      onClick={onClick}
      className={`min-h-[72px] md:min-h-[90px] p-1.5 text-left transition-colors ${
        isSelected
          ? "bg-[var(--interactive-light)] ring-2 ring-[var(--interactive)] ring-inset"
          : "bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"
      } ${rideScore ? RIDE_SCORE_BORDER[rideScore] : ""}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          isToday
            ? "bg-[var(--interactive)] text-white"
            : "text-[var(--text-primary)]"
        }`}
      >
        {day}
      </span>
      {events.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {events.slice(0, 3).map((event) => (
            <span
              key={event.id}
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other
              }`}
              title={event.title}
            />
          ))}
          {events.length > 3 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
      {/* Show first event title on desktop */}
      {events.length > 0 && (
        <div className="mt-0.5 hidden md:block">
          <p className="truncate text-[10px] leading-tight text-[var(--text-secondary)]">
            {events[0].title}
          </p>
          {events.length > 1 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              +{events.length - 1} more
            </p>
          )}
        </div>
      )}
    </button>
  );
}
