"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ScoredDay } from "@/lib/weather-rules";

const SCORE_STYLES = {
  green: "bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]",
  yellow: "bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]",
  red: "bg-[var(--error-bg)] text-[var(--error-text)] border-[var(--error-border)]",
};

const SCORE_LABELS = {
  green: "Good",
  yellow: "Caution",
  red: "No-Go",
};

interface WeatherAlert {
  type: string;
  message: string;
  severity: "green" | "yellow" | "red";
}

interface Forecast {
  current: {
    temperature_f: number;
    feels_like_f: number;
    humidity_percent: number;
    wind_speed_mph: number;
    condition: string;
    uv_index: number;
    as_of: string;
  };
  daily: Array<{
    date: string;
    high_f: number;
    low_f: number;
    precipitation_chance: number;
    condition: string;
  }>;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export default function WeatherDashboardPage() {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [rideDays, setRideDays] = useState<ScoredDay[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState("");

  // Yesterday feedback prompt
  const [yesterdayPrediction, setYesterdayPrediction] = useState<string | null>(null);
  const [showYesterdayPrompt, setShowYesterdayPrompt] = useState(false);
  const [yesterdaySubmitted, setYesterdaySubmitted] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [forecastRes, rideDaysRes, alertsRes] = await Promise.all([
          fetch("/api/weather/forecast"),
          fetch("/api/weather/ride-days"),
          fetch("/api/weather/alerts"),
        ]);

        if (forecastRes.status === 503) {
          setNotConfigured(true);
          return;
        }

        if (forecastRes.ok) setForecast(await forecastRes.json());
        let scored: ScoredDay[] = [];
        if (rideDaysRes.ok) {
          scored = await rideDaysRes.json();
          setRideDays(scored);
        }
        if (alertsRes.ok) setAlerts(await alertsRes.json());

        // Check if we need yesterday's feedback
        const yesterday = getYesterdayDate();
        const feedbackRes = await fetch(`/api/footing-feedback?date=${yesterday}`);
        if (feedbackRes.ok) {
          const { feedback } = await feedbackRes.json();
          if (!feedback) {
            const yesterdayScored = scored.find(
              (d) => d.date === yesterday
            );
            if (yesterdayScored) {
              const footingReason = yesterdayScored.reasons.find(
                (r) => r.startsWith("Footing")
              );
              setYesterdayPrediction(
                footingReason ? yesterdayScored.score : "green"
              );
              setShowYesterdayPrompt(true);
            }
          }
        }
      } catch {
        setError("Failed to load weather data");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading weather...
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="mx-auto max-w-2xl pb-20 md:pb-8">
        <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
          Weather Dashboard
        </h1>
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="mb-2 text-[var(--text-primary)] font-medium">
            WeatherKit Not Configured
          </p>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Set WEATHERKIT_* environment variables to enable weather integration.
          </p>
          <Link
            href="/settings/weather"
            className="text-sm font-medium text-[var(--interactive)] hover:underline"
          >
            Configure Weather Settings &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Weather Dashboard
      </h1>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      {/* Yesterday Footing Feedback */}
      {showYesterdayPrompt && !yesterdaySubmitted && (
        <div className="mb-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              Yesterday&apos;s footing was predicted{" "}
              <span className={`font-medium ${
                yesterdayPrediction === "red" ? "text-[var(--error-text)]"
                  : yesterdayPrediction === "yellow" ? "text-[var(--warning-text)]"
                  : "text-[var(--success-text)]"
              }`}>
                {yesterdayPrediction === "red" ? "Unsafe" : yesterdayPrediction === "yellow" ? "Caution" : "Good"}
              </span>. How was it?
            </p>
            <button
              onClick={() => setShowYesterdayPrompt(false)}
              className="text-xs text-[var(--text-muted)] hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            {(["good", "soft", "unsafe"] as const).map((rating) => {
              const styles = {
                good: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]",
                soft: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]",
                unsafe: "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]",
              };
              return (
                <button
                  key={rating}
                  onClick={async () => {
                    try {
                      await fetch("/api/footing-feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          date: getYesterdayDate(),
                          actual_footing: rating,
                        }),
                      });
                    } catch { /* non-critical */ }
                    setYesterdaySubmitted(true);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity ${styles[rating]}`}
                >
                  {rating.charAt(0).toUpperCase() + rating.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {yesterdaySubmitted && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success-text)]">
          Footing feedback recorded. Thanks!
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-3 text-sm ${SCORE_STYLES[alert.severity]}`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Current Conditions */}
      {forecast && (
        <div className="mb-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            Current Conditions
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {forecast.current.temperature_f}&deg;F
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Feels like {forecast.current.feels_like_f}&deg;F
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {forecast.current.wind_speed_mph}
              </p>
              <p className="text-xs text-[var(--text-muted)]">mph wind</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {forecast.current.humidity_percent}%
              </p>
              <p className="text-xs text-[var(--text-muted)]">humidity</p>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            {forecast.current.condition} | UV: {forecast.current.uv_index}
          </p>
        </div>
      )}

      {/* Good Riding Days */}
      {rideDays.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            Riding Days (7-Day)
          </h2>
          <div className="space-y-2">
            {rideDays.map((day) => (
              <div
                key={day.date}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${SCORE_STYLES[day.score]}`}
              >
                <div>
                  <span className="font-medium text-sm">
                    {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="ml-2 text-xs opacity-75">
                    {day.forecast.day_f}&deg;F
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium">
                    {SCORE_LABELS[day.score]}
                  </span>
                  {day.reasons.length > 0 && (
                    <p className="text-[10px] opacity-75">
                      {day.reasons[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-Day Forecast */}
      {forecast && forecast.daily.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
            7-Day Forecast
          </h2>
          <div className="space-y-1">
            {forecast.daily.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--surface-subtle)]"
              >
                <span className="w-20 text-sm font-medium text-[var(--text-primary)]">
                  {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                  })}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {day.condition}
                </span>
                <span className="text-sm text-[var(--text-primary)]">
                  {day.high_f}&deg; / {day.low_f}&deg;
                </span>
                <span className="w-16 text-right text-xs text-[var(--text-muted)]">
                  {day.precipitation_chance}% rain
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
