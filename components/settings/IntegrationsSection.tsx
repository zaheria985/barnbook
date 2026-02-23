"use client";

import { useState, useEffect, useCallback } from "react";

interface SyncStatus {
  weatherkit: {
    configured: boolean;
  };
  email_ingest: {
    configured: boolean;
  };
  icloud: {
    configured: boolean;
  };
}

interface IcloudCalendar {
  id: string;
  name: string;
  color: string | null;
  type: "calendar" | "reminders";
}

interface IcloudSettings {
  read_calendar_ids: string[];
  write_calendar_id: string | null;
  reminders_checklists_id: string | null;
  reminders_weather_id: string | null;
  reminders_treatments_id: string | null;
  use_radicale: boolean;
  radicale_checklists_collection: string | null;
  radicale_weather_collection: string | null;
  radicale_treatments_collection: string | null;
}

export default function IntegrationsSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // iCloud state
  const [calendars, setCalendars] = useState<IcloudCalendar[]>([]);
  const [icloudSettings, setIcloudSettings] = useState<IcloudSettings>({
    read_calendar_ids: [],
    write_calendar_id: null,
    reminders_checklists_id: null,
    reminders_weather_id: null,
    reminders_treatments_id: null,
    use_radicale: false,
    radicale_checklists_collection: null,
    radicale_weather_collection: null,
    radicale_treatments_collection: null,
  });
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [icloudSaving, setIcloudSaving] = useState(false);
  const [icloudSyncing, setIcloudSyncing] = useState(false);
  const [icloudMessage, setIcloudMessage] = useState("");

  // Radicale state
  const [radicaleCollections, setRadicaleCollections] = useState<{id: string; name: string}[]>([]);
  const [radicaleConfigured, setRadicaleConfigured] = useState(false);

  const fetchCalendars = useCallback(async () => {
    setCalendarsLoading(true);
    try {
      const [calRes, settingsRes] = await Promise.all([
        fetch("/api/sync/icloud/calendars"),
        fetch("/api/sync/icloud/settings"),
      ]);
      if (calRes.ok) {
        const data = await calRes.json();
        setCalendars(data.calendars || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setIcloudSettings({
          read_calendar_ids: data.read_calendar_ids || [],
          write_calendar_id: data.write_calendar_id || null,
          reminders_checklists_id: data.reminders_checklists_id || null,
          reminders_weather_id: data.reminders_weather_id || null,
          reminders_treatments_id: data.reminders_treatments_id || null,
          use_radicale: data.use_radicale ?? false,
          radicale_checklists_collection: data.radicale_checklists_collection || null,
          radicale_weather_collection: data.radicale_weather_collection || null,
          radicale_treatments_collection: data.radicale_treatments_collection || null,
        });
      }
      // Also fetch Radicale collections
      try {
        const radRes = await fetch("/api/sync/radicale/collections");
        if (radRes.ok) {
          const radData = await radRes.json();
          setRadicaleConfigured(radData.configured);
          setRadicaleCollections(radData.collections || []);
        }
      } catch {
        // Radicale fetch failed
      }
    } catch {
      // Calendar fetch failed — shown as empty list
    } finally {
      setCalendarsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/sync/status");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setStatus(data);

        // If iCloud or Radicale is configured, fetch calendars + collections
        if (data.icloud?.configured || data.radicale?.configured) {
          fetchCalendars();
        }

      } catch {
        setError("Failed to load integration status");
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [fetchCalendars]);

  async function saveIcloudSettings() {
    setIcloudSaving(true);
    setIcloudMessage("");
    try {
      const res = await fetch("/api/sync/icloud/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(icloudSettings),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setIcloudMessage(
        data.reminders_reset
          ? "Settings saved — old reminders cleared. Hit Sync Now to create them in Radicale."
          : "Settings saved"
      );
    } catch {
      setIcloudMessage("Failed to save settings");
    } finally {
      setIcloudSaving(false);
    }
  }

  async function triggerIcloudSync() {
    setIcloudSyncing(true);
    setIcloudMessage("");
    try {
      const res = await fetch("/api/sync/icloud", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      const data = await res.json();
      const parts = [
        `${data.events_found} events found`,
        `${data.keywords_matched} matched`,
        `${data.windows_suggested} ride windows`,
      ];
      const reminders = (data.blanket_reminders || 0) + (data.treatment_reminders || 0) + (data.checklists_pushed || 0);
      if (reminders > 0) parts.push(`${reminders} reminders created`);
      setIcloudMessage(`Synced: ${parts.join(", ")}`);
    } catch (err) {
      setIcloudMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIcloudSyncing(false);
    }
  }

  function toggleReadCalendar(id: string) {
    setIcloudSettings((prev) => {
      const ids = prev.read_calendar_ids.includes(id)
        ? prev.read_calendar_ids.filter((c) => c !== id)
        : [...prev.read_calendar_ids, id];
      return { ...prev, read_calendar_ids: ids };
    });
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        Loading integrations...
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* iCloud CalDAV */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                iCloud Calendar
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Auto-detect equestrian events and suggest ride windows
              </p>
            </div>
            <StatusBadge
              configured={status?.icloud?.configured ?? false}
              connected={status?.icloud?.configured ?? false}
            />
          </div>
          {status?.icloud?.configured ? (
            <div className="mt-3 space-y-3">
              {calendarsLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Loading calendars...</p>
              ) : calendars.length > 0 ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Read calendars (event detection)
                    </label>
                    <div className="space-y-1">
                      {calendars.filter((c) => c.type === "calendar").map((cal) => (
                        <label key={cal.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={icloudSettings.read_calendar_ids.includes(cal.id)}
                            onChange={() => toggleReadCalendar(cal.id)}
                            className="rounded border-[var(--border)]"
                          />
                          {cal.color && (
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: cal.color }}
                            />
                          )}
                          <span className="text-[var(--text-primary)]">{cal.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Write calendar (ride windows)
                    </label>
                    <select
                      value={icloudSettings.write_calendar_id || ""}
                      onChange={(e) =>
                        setIcloudSettings((prev) => ({
                          ...prev,
                          write_calendar_id: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">None (don&apos;t write ride windows)</option>
                      {calendars.filter((c) => c.type === "calendar").map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Apple Reminders lists
                    </label>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">
                      Only CalDAV-compatible lists appear here. All three can use the same list — reminders are distinguished by title.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Event checklists
                    </label>
                    <select
                      value={icloudSettings.reminders_checklists_id || ""}
                      onChange={(e) =>
                        setIcloudSettings((prev) => ({
                          ...prev,
                          reminders_checklists_id: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">None</option>
                      {calendars.filter((c) => c.type === "reminders").map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      For show/vet/farrier checklists
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Weather alerts
                    </label>
                    <select
                      value={icloudSettings.reminders_weather_id || ""}
                      onChange={(e) =>
                        setIcloudSettings((prev) => ({
                          ...prev,
                          reminders_weather_id: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">None</option>
                      {calendars.filter((c) => c.type === "reminders").map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      For blanket reminders
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Treatment reminders
                    </label>
                    <select
                      value={icloudSettings.reminders_treatments_id || ""}
                      onChange={(e) =>
                        setIcloudSettings((prev) => ({
                          ...prev,
                          reminders_treatments_id: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">None</option>
                      {calendars.filter((c) => c.type === "reminders").map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      For recurring treatment schedules
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveIcloudSettings}
                      disabled={icloudSaving}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {icloudSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={triggerIcloudSync}
                      disabled={icloudSyncing}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      {icloudSyncing ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                  {icloudMessage && (
                    <p className="text-xs text-[var(--text-muted)]">{icloudMessage}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  No calendars found. Check your iCloud credentials.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">
                Set <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">ICLOUD_APPLE_ID</code> and{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">ICLOUD_APP_PASSWORD</code> environment variables to enable.
              </p>
            </div>
          )}
        </div>

        {/* Radicale Self-Hosted Reminders */}
        {radicaleConfigured && (
          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Radicale Reminders
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Self-hosted CalDAV reminders via Radicale
                </p>
              </div>
              <StatusBadge configured={true} connected={true} />
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setIcloudSettings(prev => ({ ...prev, use_radicale: false }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    !icloudSettings.use_radicale
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  iCloud CalDAV
                </button>
                <button
                  onClick={() => setIcloudSettings(prev => ({ ...prev, use_radicale: true }))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    icloudSettings.use_radicale
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  Radicale (self-hosted)
                </button>
              </div>
              {icloudSettings.use_radicale && (
                radicaleCollections.length > 0 ? (
                  <>
                    <p className="text-xs text-[var(--text-muted)]">
                      Reminders are written to your self-hosted Radicale server. Add this CalDAV account to your iPhone to see them in Apple Reminders.
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                        Event checklists
                      </label>
                      <select
                        value={icloudSettings.radicale_checklists_collection || ""}
                        onChange={(e) =>
                          setIcloudSettings((prev) => ({
                            ...prev,
                            radicale_checklists_collection: e.target.value || null,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                      >
                        <option value="">None</option>
                        {radicaleCollections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                        Weather alerts
                      </label>
                      <select
                        value={icloudSettings.radicale_weather_collection || ""}
                        onChange={(e) =>
                          setIcloudSettings((prev) => ({
                            ...prev,
                            radicale_weather_collection: e.target.value || null,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                      >
                        <option value="">None</option>
                        {radicaleCollections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                        Treatment reminders
                      </label>
                      <select
                        value={icloudSettings.radicale_treatments_collection || ""}
                        onChange={(e) =>
                          setIcloudSettings((prev) => ({
                            ...prev,
                            radicale_treatments_collection: e.target.value || null,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                      >
                        <option value="">None</option>
                        {radicaleCollections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-2">
                      No reminder lists found in Radicale. Create the default lists to get started.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/sync/radicale/collections", { method: "POST" });
                          if (res.ok) {
                            // Refresh collections
                            const radRes = await fetch("/api/sync/radicale/collections");
                            if (radRes.ok) {
                              const radData = await radRes.json();
                              setRadicaleCollections(radData.collections || []);
                            }
                          }
                        } catch {
                          // Failed to create
                        }
                      }}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Create Lists
                    </button>
                  </div>
                )
              )}
              <button
                onClick={saveIcloudSettings}
                disabled={icloudSaving}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {icloudSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* WeatherKit */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                OpenWeatherMap
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Weather forecasts and ride-day scoring via OpenWeatherMap
              </p>
            </div>
            <StatusBadge
              configured={status?.weatherkit.configured ?? false}
              connected={status?.weatherkit.configured ?? false}
            />
          </div>
          {!status?.weatherkit.configured && (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">
                Set <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">OPENWEATHERMAP_API_KEY</code> environment variable to enable.
              </p>
            </div>
          )}
        </div>

        {/* Email Ingestion */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Email Ingestion
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Auto-parse Venmo receipts into expenses
              </p>
            </div>
            <StatusBadge
              configured={status?.email_ingest.configured ?? false}
              connected={status?.email_ingest.configured ?? false}
            />
          </div>
          {status?.email_ingest.configured ? (
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Webhook</span>
                <code className="text-xs text-[var(--text-primary)]">POST /api/email/ingest</code>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Send email webhook requests with <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">Authorization: Bearer &lt;EMAIL_INGEST_SECRET&gt;</code>
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">
                Set <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">EMAIL_INGEST_SECRET</code> environment variable to enable.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatusBadge({
  configured,
  connected,
}: {
  configured: boolean;
  connected: boolean;
}) {
  if (!configured) {
    return (
      <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
        Not Configured
      </span>
    );
  }
  if (connected) {
    return (
      <span className="rounded-full bg-[var(--success-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--success-text)]">
        Connected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--error-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--error-text)]">
      Error
    </span>
  );
}
