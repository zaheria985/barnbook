"use client";

import DayCell from "./DayCell";
import type { Event } from "@/lib/queries/events";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthGrid({
  year,
  month,
  events,
  onDayClick,
  selectedDate,
  rideScores,
}: {
  year: number;
  month: number; // 1-based
  events: Event[];
  onDayClick: (date: string) => void;
  selectedDate: string | null;
  rideScores?: Record<string, "green" | "yellow" | "red">;
}) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Build grid cells
  const cells: { date: string | null; day: number | null }[] = [];

  // Leading empty cells
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: null, day: null });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d });
  }

  // Group events by date
  const eventsByDate: Record<string, Event[]> = {};
  for (const event of events) {
    const dateKey = event.start_date.split("T")[0];
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    eventsByDate[dateKey].push(event);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px rounded-t-lg bg-[var(--border-light)] overflow-hidden">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-[var(--surface-muted)] px-2 py-2 text-center text-xs font-medium text-[var(--text-muted)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-b-lg bg-[var(--border-light)] overflow-hidden">
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            date={cell.date}
            day={cell.day}
            events={cell.date ? eventsByDate[cell.date] || [] : []}
            isToday={cell.date === today}
            isSelected={cell.date === selectedDate}
            rideScore={cell.date && rideScores ? rideScores[cell.date] : undefined}
            onClick={cell.date ? () => onDayClick(cell.date!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
