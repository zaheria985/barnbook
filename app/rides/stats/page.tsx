"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RideStats } from "@/lib/queries/rides";

const GAIT_COLORS = {
  Walk: "var(--gait-walk)",
  Trot: "var(--gait-trot)",
  Canter: "var(--gait-canter)",
};

export default function RideStatsPage() {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState<RideStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, date });
      const res = await fetch(`/api/rides/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      setStats(await res.json());
    } catch {
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  }, [period, date]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const gaitPieData = stats
    ? [
        { name: "Walk", value: stats.total_walk_minutes },
        { name: "Trot", value: stats.total_trot_minutes },
        { name: "Canter", value: stats.total_canter_minutes },
      ].filter((d) => d.value > 0)
    : [];

  const calByDate =
    stats?.rides_by_date.map((d) => ({
      date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      calories: d.total_calories,
      minutes: d.total_minutes,
    })) || [];

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Ride Statistics
          </h1>
          <Link
            href="/rides"
            className="text-sm text-[var(--interactive)] hover:underline"
          >
            Back to Ride Log
          </Link>
        </div>
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

      {/* Period toggle + date picker */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setPeriod("week")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === "week"
                ? "bg-[var(--interactive)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === "month"
                ? "bg-[var(--interactive)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            Month
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Loading stats...
        </div>
      ) : !stats || stats.total_rides === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No rides in this {period}. Log some rides first!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.total_rides}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Rides</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {Math.floor(stats.total_duration_minutes / 60)}h{" "}
                {stats.total_duration_minutes % 60}m
              </div>
              <div className="text-xs text-[var(--text-muted)]">Total Time</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.total_calories.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Calories</div>
            </div>
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.total_distance_miles}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Miles</div>
            </div>
          </div>

          {/* Gait pie chart */}
          {gaitPieData.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
              <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">
                Time per Gait
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={gaitPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}m`}
                  >
                    {gaitPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          GAIT_COLORS[entry.name as keyof typeof GAIT_COLORS]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Calories over time bar chart */}
          {calByDate.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
              <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">
                Calories Over Time
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={calByDate}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="calories"
                    fill="var(--interactive)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-horse breakdown */}
          {stats.rides_by_horse.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
              <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
                Per-Horse Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 text-left font-medium text-[var(--text-secondary)]">
                        Horse
                      </th>
                      <th className="py-2 text-right font-medium text-[var(--text-secondary)]">
                        Rides
                      </th>
                      <th className="py-2 text-right font-medium text-[var(--text-secondary)]">
                        Time
                      </th>
                      <th className="py-2 text-right font-medium text-[var(--text-secondary)]">
                        Calories
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rides_by_horse.map((h) => (
                      <tr
                        key={h.horse_id}
                        className="border-b border-[var(--border-light)]"
                      >
                        <td className="py-2 text-[var(--text-primary)]">
                          {h.horse_name}
                        </td>
                        <td className="py-2 text-right text-[var(--text-secondary)]">
                          {h.ride_count}
                        </td>
                        <td className="py-2 text-right text-[var(--text-secondary)]">
                          {Math.floor(h.total_minutes / 60)}h{" "}
                          {h.total_minutes % 60}m
                        </td>
                        <td className="py-2 text-right text-[var(--text-secondary)]">
                          {h.total_calories.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
