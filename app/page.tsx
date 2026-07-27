"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
import { SkeletonCard } from "@/components/ui/PageSkeleton";
import { localToday, localYearMonth } from "@/lib/dates";
import {
  formatTime12h,
  normalizeICalEvent,
  toDateKey,
  type ICalDisplayEvent,
} from "@/lib/ical-display";
import type { SuggestedWindow } from "@/lib/queries/icloud-sync";

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
  total_income_projected: number;
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

function fmtWeekday(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

/** "HH:MM:SS" → "9 AM" style display. */
function fmtWindowTime(t: string) {
  return formatTime12h(t.substring(0, 5));
}

type WeekItem =
  | { kind: "barn"; id: string; date: string; title: string; time: string | null; event_type: string }
  | { kind: "icloud"; id: string; date: string; title: string; time: string | null };

export default function Home() {
  const [rideDays, setRideDays] = useState<ScoredDay[]>([]);
  const [windows, setWindows] = useState<SuggestedWindow[]>([]);
  const [weekItems, setWeekItems] = useState<WeekItem[]>([]);
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
      fetch(`/api/calendar-intel/windows?from=${today}&to=${weekOut}`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`/api/calendar-intel/ical-events?from=${today}&to=${weekOut}`).then((r) =>
        r.ok ? r.json() : null
      ),
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
      const wins = value<SuggestedWindow[]>(5, []);
      const icloud = value<{ events?: unknown[] } | null>(6, null);

      if (Array.isArray(rd)) setRideDays(rd.slice(0, 7));
      if (Array.isArray(wins)) setWindows(wins);

      const items: WeekItem[] = [];
      if (Array.isArray(ev)) {
        for (const e of ev) {
          const date = e.start_date.split("T")[0];
          if (date < today) continue;
          items.push({
            kind: "barn",
            id: e.id,
            date,
            title: e.title,
            time: e.start_time ? formatTime12h(e.start_time.substring(0, 5)) : null,
            event_type: e.event_type,
          });
        }
      }
      if (icloud && Array.isArray(icloud.events)) {
        for (const raw of icloud.events) {
          const n: ICalDisplayEvent = normalizeICalEvent(
            raw as Parameters<typeof normalizeICalEvent>[0]
          );
          if (n.date < today) continue;
          items.push({
            kind: "icloud",
            id: n.uid,
            date: n.date,
            title: n.summary,
            time: n.time,
          });
        }
      }
      items.sort((a, b) => a.date.localeCompare(b.date));
      setWeekItems(items.slice(0, 7));

      if (Array.isArray(dueItems)) setDue(dueItems.slice(0, 6));
      if (Array.isArray(pending)) setPendingCount(pending.length);
      if (ov) setOverview(ov);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 h-8 w-52 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      </div>
    );
  }

  const today = localToday();
  // Best ride: first green day (else first yellow), with its earliest window.
  const bestDay =
    rideDays.find((d) => d.score === "green") ??
    rideDays.find((d) => d.score === "yellow") ??
    null;
  const bestWindow = bestDay
    ? windows.find((w) => toDateKey(String(w.date)) === bestDay.date) ?? null
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Today at the Barn</h1>
        <span className="text-sm text-[var(--text-muted)]">{fmtDay(today)}</span>
      </div>

      {/* Ride-window hero */}
      {rideDays.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              {bestDay ? (
                <>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    Best ride: {fmtDay(bestDay.date)}
                    {bestWindow &&
                      ` · ${fmtWindowTime(bestWindow.start_time)}–${fmtWindowTime(bestWindow.end_time)}`}
                    {` · ${bestDay.forecast.day_f}°`}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                    {SCORE_LABEL[bestDay.score]}
                    {bestDay.reasons.length > 0 && ` — ${bestDay.reasons.join(", ")}`}
                  </p>
                </>
              ) : (
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  No good riding days in the forecast
                </p>
              )}
            </div>
            <Link
              href="/calendar/weather"
              className="shrink-0 text-xs text-[var(--interactive)] hover:underline"
            >
              Weather →
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {rideDays.map((d) => (
              <div
                key={d.date}
                className={`rounded-lg border px-1 py-1.5 text-center ${SCORE_CLASS[d.score]}`}
              >
                <p className="text-[10px] font-medium">{fmtWeekday(d.date)}</p>
                <p className="text-sm font-bold">{d.forecast.day_f}°</p>
                <p className="sr-only">{SCORE_LABEL[d.score]}</p>
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
              <Link
                href={`/horses/${d.horse_id}`}
                key={`${d.horse_id}-${d.kind}-${d.label}-${i}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  d.days_until < 0
                    ? "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)] hover:opacity-90"
                    : "border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
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
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* This week: barn + iCloud merged */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">This week</h2>
          <Link href="/calendar" className="text-xs text-[var(--interactive)] hover:underline">
            Calendar →
          </Link>
        </div>
        {weekItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
            No events in the next week.
          </p>
        ) : (
          <div className="space-y-1">
            {weekItems.map((e) => (
              <div
                key={`${e.kind}-${e.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {fmtDay(e.date)}
                    {e.time ? ` ${e.time}` : ""}
                  </span>
                  <span
                    className={`truncate ${
                      e.kind === "icloud"
                        ? "italic text-[var(--text-secondary)]"
                        : "font-medium text-[var(--text-primary)]"
                    }`}
                  >
                    {e.title}
                  </span>
                </span>
                {e.kind === "icloud" && (
                  <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                    iCloud
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget health */}
      {overview && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">This month</h2>
            <Link href="/budget" className="text-xs text-[var(--interactive)] hover:underline">
              Budget →
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Spent</span>
              <span
                className={`font-semibold ${
                  overview.total_spent > overview.total_budgeted
                    ? "text-[var(--error-text)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {money(overview.total_spent)} of {money(overview.total_budgeted)}
              </span>
            </div>
            <ProgressBar value={overview.total_spent} max={overview.total_budgeted} />
            <div className="mt-2 flex items-baseline justify-between text-xs text-[var(--text-muted)]">
              <span>
                Income {money(overview.total_income_actual)} of{" "}
                {money(overview.total_income_projected)} projected
              </span>
              <span>
                Net {money(overview.total_income_actual - overview.total_spent)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          href="/budget/entry"
          className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          + Expense
        </Link>
        <Link
          href="/calendar/event"
          className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          + Event
        </Link>
        <Link
          href="/rides/entry"
          className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          + Ride
        </Link>
        <Link
          href="/calendar/digest"
          className="rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          Weekly digest
        </Link>
      </div>

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
