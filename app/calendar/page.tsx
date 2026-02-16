"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthGrid from "@/components/calendar/MonthGrid";
import EventCard from "@/components/calendar/EventCard";
import type { Event } from "@/lib/queries/events";

interface ScoredDay {
  date: string;
  score: "green" | "yellow" | "red";
  reasons: string[];
  forecast: {
    high_f: number;
    low_f: number;
    precipitation_chance: number;
    condition: string;
  };
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<Event[]>([]);
  const [rideDays, setRideDays] = useState<ScoredDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0);
      const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const [eventsRes, rideDaysRes] = await Promise.all([
        fetch(`/api/events?from=${firstDay}&to=${lastDayStr}`),
        fetch("/api/weather/ride-days").catch(() => null),
      ]);

      if (!eventsRes.ok) throw new Error("Failed to fetch events");
      setEvents(await eventsRes.json());

      // Ride days may 503 if weather not configured — that's fine
      if (rideDaysRes && rideDaysRes.ok) {
        setRideDays(await rideDaysRes.json());
      }
    } catch {
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDate(null);
  }

  const label = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedEvents = selectedDate
    ? events.filter((e) => e.start_date.split("T")[0] === selectedDate)
    : [];

  // Build ride score map for the grid
  const rideScores: Record<string, "green" | "yellow" | "red"> = {};
  for (const day of rideDays) {
    rideScores[day.date] = day.score;
  }

  return (
    <div className="mx-auto max-w-3xl pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Calendar
        </h1>
        <Link
          href="/calendar/event"
          className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
        >
          + Add Event
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mb-4 flex gap-2">
        <Link
          href="/calendar/weather"
          className="flex-1 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          Weather Dashboard
        </Link>
        <Link
          href="/calendar/digest"
          className="flex-1 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          Weekly Digest
        </Link>
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

      {/* 7-Day Forecast Row (when available) */}
      {rideDays.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-2xl border border-[var(--border-light)] bg-[var(--surface)]">
          <div className="flex min-w-max">
            {rideDays.slice(0, 7).map((day) => {
              const scoreColor =
                day.score === "green"
                  ? "text-[var(--success-text)]"
                  : day.score === "yellow"
                  ? "text-[var(--warning-text)]"
                  : "text-[var(--error-text)]";
              const scoreBg =
                day.score === "green"
                  ? "bg-[var(--success-bg)]"
                  : day.score === "yellow"
                  ? "bg-[var(--warning-bg)]"
                  : "bg-[var(--error-bg)]";
              return (
                <div
                  key={day.date}
                  className={`flex-1 px-2 py-2 text-center border-r last:border-r-0 border-[var(--border-light)] ${scoreBg}`}
                >
                  <p className="text-[10px] font-medium text-[var(--text-muted)]">
                    {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {day.forecast.high_f}&deg;
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {day.forecast.low_f}&deg;
                  </p>
                  <p className={`text-[10px] font-medium ${scoreColor}`}>
                    {day.forecast.precipitation_chance > 0
                      ? `${day.forecast.precipitation_chance}%`
                      : day.score === "green"
                      ? "Good"
                      : day.score === "yellow"
                      ? "Caution"
                      : "No-Go"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month Navigator */}
      <div className="mb-4 flex items-center justify-center gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] px-4 py-2">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="min-w-[140px] text-center font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <button
          onClick={nextMonth}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Ride Score Legend */}
      {rideDays.length > 0 && (
        <div className="mb-2 flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border-l-2 border-l-[var(--success-text)] bg-[var(--success-bg)]" />
            Good
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border-l-2 border-l-[var(--warning-text)] bg-[var(--warning-bg)]" />
            Caution
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border-l-2 border-l-[var(--error-text)] bg-[var(--error-bg)]" />
            No-Go
          </span>
        </div>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Loading calendar...
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-light)] overflow-hidden">
          <MonthGrid
            year={year}
            month={month}
            events={events}
            selectedDate={selectedDate}
            rideScores={rideScores}
            onDayClick={(date) =>
              setSelectedDate(date === selectedDate ? null : date)
            }
          />
        </div>
      )}

      {/* Selected Day Events */}
      {selectedDate && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            <Link
              href={`/calendar/event?date=${selectedDate}`}
              className="text-xs font-medium text-[var(--interactive)] hover:underline"
            >
              + Add Event
            </Link>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              No events on this day
            </p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Events */}
      {!selectedDate && events.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
            Events this month
          </h2>
          <div className="space-y-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
