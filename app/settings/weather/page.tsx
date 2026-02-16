"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import type { WeatherSettings } from "@/lib/queries/weather-settings";
import type { RideSlot } from "@/lib/queries/ride-schedule";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function WeatherSettingsPage() {
  const [settings, setSettings] = useState<WeatherSettings | null>(null);
  const [schedule, setSchedule] = useState<RideSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  // Schedule modal
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotDay, setSlotDay] = useState(0);
  const [slotStart, setSlotStart] = useState("08:00");
  const [slotEnd, setSlotEnd] = useState("09:00");

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, scheduleRes] = await Promise.all([
        fetch("/api/weather/settings"),
        fetch("/api/schedule"),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (scheduleRes.ok) setSchedule(await scheduleRes.json());
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/weather/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_lat: settings.location_lat,
          location_lng: settings.location_lng,
          rain_cutoff_inches: settings.rain_cutoff_inches,
          rain_window_hours: settings.rain_window_hours,
          cold_alert_temp_f: settings.cold_alert_temp_f,
          heat_alert_temp_f: settings.heat_alert_temp_f,
          wind_cutoff_mph: settings.wind_cutoff_mph,
          has_indoor_arena: settings.has_indoor_arena,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSettings(await res.json());
      setSuccess("Settings saved");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: slotDay,
          start_time: slotStart,
          end_time: slotEnd,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setSlotModalOpen(false);
      await fetchData();
    } catch {
      setError("Failed to add schedule slot");
    }
  }

  async function handleDeleteSlot(id: string) {
    try {
      const res = await fetch(`/api/schedule/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSchedule((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Failed to delete slot");
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">Loading...</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 md:pb-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
        Weather & Ride Settings
      </h1>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {success}
        </div>
      )}

      {/* Weather Thresholds */}
      {settings && (
        <form onSubmit={handleSaveSettings} className="mb-6 space-y-4">
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Location</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.location_lat ?? ""}
                  onChange={(e) => setSettings({ ...settings, location_lat: e.target.value ? Number(e.target.value) : null })}
                  placeholder="e.g. 38.8977"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settings.location_lng ?? ""}
                  onChange={(e) => setSettings({ ...settings, location_lng: e.target.value ? Number(e.target.value) : null })}
                  placeholder="e.g. -77.0365"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Thresholds</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Rain Cutoff (inches)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.rain_cutoff_inches}
                  onChange={(e) => setSettings({ ...settings, rain_cutoff_inches: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Rain Window (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.rain_window_hours}
                  onChange={(e) => setSettings({ ...settings, rain_window_hours: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Cold Alert (&deg;F)</label>
                <input
                  type="number"
                  value={settings.cold_alert_temp_f}
                  onChange={(e) => setSettings({ ...settings, cold_alert_temp_f: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Heat Alert (&deg;F)</label>
                <input
                  type="number"
                  value={settings.heat_alert_temp_f}
                  onChange={(e) => setSettings({ ...settings, heat_alert_temp_f: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Wind Cutoff (mph)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.wind_cutoff_mph}
                  onChange={(e) => setSettings({ ...settings, wind_cutoff_mph: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
                />
              </div>
              <div className="flex items-center gap-3 self-end pb-2">
                <input
                  type="checkbox"
                  id="indoor-arena"
                  checked={settings.has_indoor_arena}
                  onChange={(e) => setSettings({ ...settings, has_indoor_arena: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--interactive)]"
                />
                <label htmlFor="indoor-arena" className="text-sm font-medium text-[var(--text-secondary)]">
                  Has Indoor Arena
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      )}

      {/* Ride Schedule */}
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Ride Schedule
          </h2>
          <button
            onClick={() => setSlotModalOpen(true)}
            className="text-sm font-medium text-[var(--interactive)] hover:underline"
          >
            + Add Slot
          </button>
        </div>

        {schedule.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] italic">
            No ride slots configured. Add your weekly riding schedule.
          </p>
        ) : (
          <div className="space-y-1">
            {schedule.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--surface-subtle)]"
              >
                <span className="text-sm text-[var(--text-primary)]">
                  <span className="font-medium">{DAY_NAMES[slot.day_of_week]}</span>{" "}
                  {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                </span>
                <button
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--error-text)]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        title="Add Ride Slot"
      >
        <form onSubmit={handleAddSlot} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Day</label>
            <select
              value={slotDay}
              onChange={(e) => setSlotDay(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
            >
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Start Time</label>
              <input
                type="time"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">End Time</label>
              <input
                type="time"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--input-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus-ring)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSlotModalOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--interactive-hover)] transition-colors"
            >
              Add Slot
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
