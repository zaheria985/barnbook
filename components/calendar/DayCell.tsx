"use client";

import type { Event } from "@/lib/queries/events";

export type SpanPosition = "single" | "start" | "middle" | "end";
export type SpannedEvent = Event & { spanPosition: SpanPosition };

const EVENT_TYPE_COLORS: Record<string, string> = {
  show: "bg-[var(--interactive)]",
  vet: "bg-[var(--accent-rose)]",
  farrier: "bg-[var(--accent-amber)]",
  lesson: "bg-[var(--accent-blue)]",
  pony_club: "bg-[var(--accent-emerald)]",
  clinic: "bg-[var(--accent-teal)]",
  other: "bg-[var(--text-muted)]",
};

const EVENT_TYPE_BAR_COLORS: Record<string, string> = {
  show: "bg-[var(--interactive-light)]",
  vet: "bg-[var(--error-bg)]",
  farrier: "bg-[var(--warning-bg)]",
  lesson: "bg-[var(--success-bg)]",
  pony_club: "bg-[var(--success-bg)]",
  clinic: "bg-[var(--interactive-light)]",
  other: "bg-[var(--surface-muted)]",
};

const EVENT_TYPE_BAR_TEXT: Record<string, string> = {
  show: "text-[var(--interactive)]",
  vet: "text-[var(--error-text)]",
  farrier: "text-[var(--warning-text)]",
  lesson: "text-[var(--accent-blue)]",
  pony_club: "text-[var(--success-text)]",
  clinic: "text-[var(--accent-teal)]",
  other: "text-[var(--text-muted)]",
};

const RIDE_SCORE_BORDER: Record<string, string> = {
  green: "border-l-2 border-l-[var(--accent-emerald)]",
  yellow: "border-l-2 border-l-[var(--accent-amber)]",
  red: "border-l-2 border-l-[var(--accent-rose)]",
};

function EventDot({ event }: { event: SpannedEvent }) {
  if (event.spanPosition === "middle" || event.spanPosition === "end") {
    // Continuation: show a thin bar instead of a dot
    return (
      <span
        className={`inline-block h-1.5 w-3 rounded-sm ${
          EVENT_TYPE_BAR_COLORS[event.event_type] || EVENT_TYPE_BAR_COLORS.other
        }`}
        title={`${event.title} (cont.)`}
      />
    );
  }
  if (event.spanPosition === "start") {
    // Start of multi-day: show a dot with a trailing bar
    return (
      <span className="inline-flex items-center gap-0" title={event.title}>
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other
          }`}
        />
        <span
          className={`inline-block h-1 w-1.5 ${
            EVENT_TYPE_BAR_COLORS[event.event_type] || EVENT_TYPE_BAR_COLORS.other
          }`}
        />
      </span>
    );
  }
  // Single day: normal dot
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other
      }`}
      title={event.title}
    />
  );
}

function EventTitle({ event }: { event: SpannedEvent }) {
  if (event.spanPosition === "middle") {
    return (
      <p
        className={`truncate text-[10px] leading-tight ${
          EVENT_TYPE_BAR_TEXT[event.event_type] || EVENT_TYPE_BAR_TEXT.other
        }`}
      >
        &hellip; {event.title}
      </p>
    );
  }
  if (event.spanPosition === "end") {
    return (
      <p
        className={`truncate text-[10px] leading-tight ${
          EVENT_TYPE_BAR_TEXT[event.event_type] || EVENT_TYPE_BAR_TEXT.other
        }`}
      >
        &larr; {event.title}
      </p>
    );
  }
  if (event.spanPosition === "start") {
    return (
      <p className="truncate text-[10px] leading-tight text-[var(--text-secondary)]">
        {event.title} &rarr;
      </p>
    );
  }
  return (
    <p className="truncate text-[10px] leading-tight text-[var(--text-secondary)]">
      {event.title}
    </p>
  );
}

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
  events: SpannedEvent[];
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
          {events.slice(0, 3).map((event, idx) => (
            <EventDot key={`${event.id}-${idx}`} event={event} />
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
          <EventTitle event={events[0]} />
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
