"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StatCard from "@/components/ui/StatCard";
import { localToday, localYearMonth } from "@/lib/dates";

interface ScoredDay {
  date: string;
  score: "green" | "yellow" | "red";
  reasons: string[];
  forecast: { day_f: number; high_f: number; low_f: number };
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  start_time: string | null;
}

interface DueItem {
  horse_id: string;
  horse_name: string;
  kind: "vaccine" | "farrier";
  label: string;
  due_date: string;
  days_until: number;
}

interface Overview {
  total_budgeted: number;
  total_spent: number;
  total_income_actual: number;
}

const SCORE_LABEL = { green: "Good", yellow: "Caution", red: "No-Go" } as const;
const SCORE_CLASS = {
  green: "bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]",
  yellow: "bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]",
  red: "bg-[var(--error-bg)] text-[var(--error-text)] border-[var(--error-border)]",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDay(date: string) {
  return new Date(date.split("T")[0] + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const [rideDays, setRideDays] = useState<ScoredDay[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [due, setDue] = useState<DueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = localToday();
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0];
    const month = localYearMonth();

    Promise.allSettled([
      fetch("/api/weather/ride-days").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/events?from=${today}&to=${weekOut}`).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/horses/due").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/email/pending").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/budget/overview?month=${month}`).then((r) => (r.ok ? r.json() : null)),
    ]).then((results) => {
      const value = <T,>(i: number, fallback: T): T =>
        results[i].status === "fulfilled"
          ? ((results[i] as PromiseFulfilledResult<T>).value ?? fallback)
          : fallback;

      const rd = value<ScoredDay[]>(0, []);
      const ev = value<UpcomingEvent[]>(1, []);
      const dueItems = value<DueItem[]>(2, []);
      const pending = value<UpcomingEvent[]>(3, []);
      const ov = value<Overview | null>(4, null);

      if (Array.isArray(rd)) setRideDays(rd.slice(0, 3));
      if (Array.isArray(ev)) {
        setEvents(ev.filter((e) => e.start_date.split("T")[0] >= today).slice(0, 5));
      }
      if (Array.isArray(dueItems)) setDue(dueItems.slice(0, 6));
      if (Array.isArray(pending)) setPendingCount(pending.length);
      if (ov) setOverview(ov);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-[var(--text-muted)]">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl pb-20 md:pb-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">Today at the Barn</h1>

      {/* Ride days */}
      {rideDays.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Riding conditions</h2>
            <Link href="/calendar/weather" className="text-xs text-[var(--interactive)] hover:underline">
              Weather dashboard →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rideDays.map((d) => (
              <div key={d.date} className={`rounded-xl border px-3 py-2 ${SCORE_CLASS[d.score]}`}>
                <p className="text-xs font-medium">{fmtDay(d.date)}</p>
                <p className="text-lg font-bold">{d.forecast.day_f}°</p>
                <p className="text-xs font-medium">{SCORE_LABEL[d.score]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due care */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Care due</h2>
          <Link href="/horses" className="text-xs text-[var(--interactive)] hover:underline">
            Horses →
          </Link>
        </div>
        {due.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
            Nothing due in the next 30 days.
          </p>
        ) : (
          <div className="space-y-1">
            {due.map((d, i) => (
              <div
                key={`${d.horse_id}-${d.kind}-${d.label}-${i}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  d.days_until < 0
                    ? "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]"
                    : "border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-secondary)]"
                }`}
              >
                <span>
                  <span className="font-medium">{d.horse_name}</span> — {d.label}
                </span>
                <span className="text-xs">
                  {d.days_until < 0
                    ? `${Math.abs(d.days_until)}d overdue`
                    : d.days_until === 0
                      ? "today"
                      : `in ${d.days_until}d`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming events */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Next 7 days</h2>
          <Link href="/calendar" className="text-xs text-[var(--interactive)] hover:underline">
            Calendar →
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
            No events in the next week.
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--text-primary)]">{e.title}</span>
                <span className="text-xs text-[var(--text-muted)]">{fmtDay(e.start_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget snapshot */}
      {overview && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">This month</h2>
            <Link href="/budget" className="text-xs text-[var(--interactive)] hover:underline">
              Budget →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Budgeted" value={money(overview.total_budgeted)} color="blue" />
            <StatCard label="Spent" value={money(overview.total_spent)} color="rose" />
            <StatCard label="Income" value={money(overview.total_income_actual)} color="success" />
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <Link
          href="/budget/pending"
          className="flex items-center justify-between rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-text)] hover:opacity-90"
        >
          <span>{pendingCount} email expense{pendingCount === 1 ? "" : "s"} to review</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
