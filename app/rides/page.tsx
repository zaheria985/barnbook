"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthSelector from "@/components/budget/MonthSelector";
import RideCard from "@/components/rides/RideCard";
import type { RideSession } from "@/lib/queries/rides";
import type { Horse } from "@/lib/queries/horses";

function groupByDate(rides: RideSession[]): Record<string, RideSession[]> {
  const groups: Record<string, RideSession[]> = {};
  for (const ride of rides) {
    const d = ride.date.split("T")[0];
    if (!groups[d]) groups[d] = [];
    groups[d].push(ride);
  }
  return groups;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function RideLogPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [rides, setRides] = useState<RideSession[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseFilter, setHorseFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (horseFilter) params.set("horse", horseFilter);

      const [ridesRes, horsesRes] = await Promise.all([
        fetch(`/api/rides?${params}`),
        fetch("/api/horses"),
      ]);

      if (!ridesRes.ok) throw new Error("Failed to fetch rides");
      setRides(await ridesRes.json());

      if (horsesRes.ok) setHorses(await horsesRes.json());
    } catch {
      setError("Failed to load rides");
    } finally {
      setLoading(false);
    }
  }, [month, horseFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this ride?")) return;
    try {
      const res = await fetch(`/api/rides/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setRides((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Failed to delete ride");
    }
  }

  const grouped = groupByDate(rides);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalCalories = rides.reduce(
    (sum, r) => sum + (r.rider_calories_burned || 0),
    0
  );
  const totalMinutes = rides.reduce(
    (sum, r) => sum + r.total_duration_minutes,
    0
  );

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rides</h1>
        <MonthSelector value={month} onChange={setMonth} />
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

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={horseFilter}
          onChange={(e) => setHorseFilter(e.target.value)}
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        >
          <option value="">All Horses</option>
          {horses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        <Link
          href="/rides/stats"
          className="ml-auto rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
        >
          View Stats
        </Link>
      </div>

      {/* Summary bar */}
      {rides.length > 0 && (
        <div className="mb-4 flex gap-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
          <div>
            <span className="text-[var(--text-muted)]">Rides:</span>{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {rides.length}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Time:</span>{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Calories:</span>{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {totalCalories.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Loading rides...
        </div>
      ) : rides.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No rides this month. Log your first ride!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
                {formatDate(date)}
              </h2>
              <div className="space-y-2">
                {grouped[date].map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/rides/entry"
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--interactive)] text-white shadow-lg hover:bg-[var(--interactive-hover)] md:bottom-8"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </Link>
    </div>
  );
}
