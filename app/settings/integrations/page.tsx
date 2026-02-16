"use client";

import { useState, useEffect } from "react";

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
}

export default function IntegrationsSettingsPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/sync/status");
        if (!res.ok) throw new Error("Failed to fetch");
        setStatus(await res.json());
      } catch {
        setError("Failed to load integration status");
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

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
                Apple WeatherKit
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Weather forecasts and ride-day scoring
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
                Set <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">WEATHERKIT_TEAM_ID</code>,{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">WEATHERKIT_SERVICE_ID</code>,{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">WEATHERKIT_KEY_ID</code>, and{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[10px]">WEATHERKIT_PRIVATE_KEY</code> to enable.
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
