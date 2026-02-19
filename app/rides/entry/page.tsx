"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Horse } from "@/lib/queries/horses";

// Client-side calorie/mcal preview (mirrors server logic)
const RIDER_GAIT_RATES = { walk: 3.5, trot: 5.5, canter: 8.0 };
const HORSE_GAIT_RATES = { walk: 1.5, trot: 4.5, canter: 9.0 };

function previewCalories(
  walk: number,
  trot: number,
  canter: number,
  riderWeight: number
) {
  const f = riderWeight / 150;
  return Math.round(
    walk * RIDER_GAIT_RATES.walk * f +
      trot * RIDER_GAIT_RATES.trot * f +
      canter * RIDER_GAIT_RATES.canter * f
  );
}

function previewMcal(
  walk: number,
  trot: number,
  canter: number,
  horseWeight: number
) {
  const f = horseWeight / 1100;
  const mcal =
    (walk / 60) * HORSE_GAIT_RATES.walk * f +
    (trot / 60) * HORSE_GAIT_RATES.trot * f +
    (canter / 60) * HORSE_GAIT_RATES.canter * f;
  return Math.round(mcal * 100) / 100;
}

function isRecentDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(dateStr + "T00:00:00");
  return d >= yesterday && d <= today;
}

export default function RideEntryPage() {
  const router = useRouter();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Post-ride footing feedback state
  const [savedRide, setSavedRide] = useState<{ id: string; date: string } | null>(null);
  const [footingSubmitted, setFootingSubmitted] = useState(false);

  // Form state
  const [horseId, setHorseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [totalMinutes, setTotalMinutes] = useState("");
  const [walkMinutes, setWalkMinutes] = useState("");
  const [trotMinutes, setTrotMinutes] = useState("");
  const [canterMinutes, setCanterMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");

  // Rider weight for preview (fetched from profile)
  const [riderWeight, setRiderWeight] = useState(150);

  const fetchData = useCallback(async () => {
    try {
      const [horsesRes, profileRes] = await Promise.all([
        fetch("/api/horses"),
        fetch("/api/auth/profile"),
      ]);
      if (horsesRes.ok) {
        const h = await horsesRes.json();
        setHorses(h);
        if (h.length > 0) setHorseId(h[0].id);
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        if (p.weight_lbs) setRiderWeight(Number(p.weight_lbs));
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const walk = Number(walkMinutes) || 0;
  const trot = Number(trotMinutes) || 0;
  const canter = Number(canterMinutes) || 0;
  const total = Number(totalMinutes) || 0;
  const gaitSum = walk + trot + canter;
  const selectedHorse = horses.find((h) => h.id === horseId);
  const horseWeight = selectedHorse?.weight_lbs || 1100;

  const calories = previewCalories(walk, trot, canter, riderWeight);
  const mcal = previewMcal(walk, trot, canter, Number(horseWeight));

  const gaitMismatch = total > 0 && gaitSum > 0 && gaitSum !== total;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!horseId || !date || !totalMinutes) return;
    if (gaitSum !== total) {
      setError("Gait minutes must equal total duration");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horse_id: horseId,
          date,
          total_duration_minutes: total,
          walk_minutes: walk,
          trot_minutes: trot,
          canter_minutes: canter,
          distance_miles: distance ? Number(distance) : null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save ride");
      }

      const rideData = await res.json();

      // Show footing prompt for today/yesterday rides, otherwise redirect
      if (isRecentDate(date)) {
        setSavedRide({ id: rideData.id, date });
      } else {
        router.push("/rides");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ride");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  async function handleFootingFeedback(rating: "good" | "soft" | "unsafe") {
    if (!savedRide) return;
    try {
      await fetch("/api/footing-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: savedRide.date,
          ride_session_id: savedRide.id,
          actual_footing: rating,
        }),
      });
    } catch {
      // Non-critical - don't block navigation
    }
    setFootingSubmitted(true);
    setTimeout(() => router.push("/rides"), 800);
  }

  // Show footing prompt after ride save
  if (savedRide) {
    return (
      <div className="mx-auto max-w-lg pb-20">
        <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] p-6 text-center">
          <p className="mb-4 text-lg font-medium text-[var(--success-text)]">
            Ride logged!
          </p>
          {footingSubmitted ? (
            <p className="text-sm text-[var(--text-muted)]">Thanks! Redirecting...</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-[var(--text-secondary)]">
                How was the footing today?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleFootingFeedback("good")}
                  className="rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm font-medium text-[var(--success-text)] hover:opacity-80 transition-opacity"
                >
                  Good
                </button>
                <button
                  onClick={() => handleFootingFeedback("soft")}
                  className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-sm font-medium text-[var(--warning-text)] hover:opacity-80 transition-opacity"
                >
                  Soft
                </button>
                <button
                  onClick={() => handleFootingFeedback("unsafe")}
                  className="rounded-full border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error-text)] hover:opacity-80 transition-opacity"
                >
                  Unsafe
                </button>
              </div>
              <button
                onClick={() => router.push("/rides")}
                className="mt-3 text-xs text-[var(--text-muted)] hover:underline"
              >
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-20">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Log Ride
      </h1>

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

      {horses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--text-muted)]">
            No horses found.{" "}
            <a
              href="/settings/horses"
              className="text-[var(--interactive)] hover:underline"
            >
              Add a horse
            </a>{" "}
            first.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Horse picker */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Horse
            </label>
            <select
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            >
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>

          {/* Total duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Total Duration (minutes)
            </label>
            <input
              type="number"
              value={totalMinutes}
              onChange={(e) => setTotalMinutes(e.target.value)}
              placeholder="e.g. 60"
              min="1"
              required
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>

          {/* Gait breakdown */}
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
              Gait Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">
                  Walk (min)
                </label>
                <input
                  type="number"
                  value={walkMinutes}
                  onChange={(e) => setWalkMinutes(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">
                  Trot (min)
                </label>
                <input
                  type="number"
                  value={trotMinutes}
                  onChange={(e) => setTrotMinutes(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">
                  Canter (min)
                </label>
                <input
                  type="number"
                  value={canterMinutes}
                  onChange={(e) => setCanterMinutes(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
            </div>
            {gaitMismatch && (
              <p className="mt-2 text-xs text-[var(--error-text)]">
                Gait minutes ({gaitSum}) must equal total duration ({total})
              </p>
            )}
            {gaitSum > 0 && !gaitMismatch && (
              <p className="mt-2 text-xs text-[var(--success-text)]">
                Gait minutes match total duration
              </p>
            )}
          </div>

          {/* Calorie/Mcal preview */}
          {gaitSum > 0 && (
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">
                Estimated Output
              </h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">Rider Calories:</span>{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {calories} cal
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Horse Energy:</span>{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {mcal} Mcal
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Distance */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Distance (miles, optional)
            </label>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="e.g. 3.5"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the ride go?"
              rows={3}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !horseId || !total || gaitSum !== total}
            className="w-full rounded-lg bg-[var(--interactive)] py-3 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Log Ride"}
          </button>
        </form>
      )}
    </div>
  );
}
