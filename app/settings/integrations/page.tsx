"use client";

import { useState, useEffect, useCallback } from "react";

interface SyncStatus {
  vikunja: {
    configured: boolean;
    connected: boolean;
    version: string | null;
    error: string | null;
  };
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
}

interface IcloudSettings {
  read_calendar_ids: string[];
  write_calendar_id: string | null;
}

export default function IntegrationsSettingsPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // iCloud state
  const [calendars, setCalendars] = useState<IcloudCalendar[]>([]);
  const [icloudSettings, setIcloudSettings] = useState<IcloudSettings>({
    read_calendar_ids: [],
    write_calendar_id: null,
  });
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [icloudSaving, setIcloudSaving] = useState(false);
  const [icloudSyncing, setIcloudSyncing] = useState(false);
  const [icloudMessage, setIcloudMessage] = useState("");

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
        });
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

        // If iCloud is configured, fetch calendars
        if (data.icloud?.configured) {
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
      setIcloudMessage("Settings saved");
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
      setIcloudMessage(
        `Synced: ${data.events_found} events found, ${data.keywords_matched} matched, ${data.windows_suggested} ride windows`
      );
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Integrations
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          External service connections and status
        </p>
      </div>

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
                      {calendars.map((cal) => (
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
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
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

        {/* Vikunja */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Vikunja
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Task sync for Apple Reminders integration
              </p>
            </div>
            <StatusBadge
              configured={status?.vikunja.configured ?? false}
              connected={status?.vikunja.connected ?? false}
            />
          </div>
          {status?.vikunja.configured ? (
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Status</span>
                <span className={status.vikunja.connected ? "text-[var(--success-text)]" : "text-[var(--error-text)]"}>
                  {status.vikunja.connected ? "Connected" : "Connection failed"}
                </span>
              </div>
              {status.vikunja.version && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Version</span>
                  <span className="text-[var(--text-primary)]">{status.vikunja.version}</span>
                </div>
              )}
              {status.vikunja.error && !status.vikunja.connected && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Error</span>
                  <span className="text-[var(--error-text)]">{status.vikunja.error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">
                Set <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">VIKUNJA_URL</code> and{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">VIKUNJA_API_TOKEN</code> environment variables to enable.
              </p>
            </div>
          )}
        </div>

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
    </div>
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
