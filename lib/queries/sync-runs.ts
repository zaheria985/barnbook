import pool from "@/lib/db";

export type SyncType = "icloud" | "reminders_push" | "reminders_pull";
export type SyncStatus = "success" | "error";

export interface SyncRun {
  sync_type: string;
  last_run_at: string;
  last_status: string;
  last_error: string | null;
  detail: unknown;
  updated_at: string;
}

/** Record the outcome of a background sync so failures are visible. Best-effort:
 *  callers should not let a logging failure break the sync itself. */
export async function recordSyncRun(
  syncType: SyncType,
  status: SyncStatus,
  error?: string | null,
  detail?: unknown
): Promise<void> {
  await pool.query(
    `INSERT INTO sync_runs (sync_type, last_run_at, last_status, last_error, detail, updated_at)
     VALUES ($1, now(), $2, $3, $4, now())
     ON CONFLICT (sync_type) DO UPDATE SET
       last_run_at = now(),
       last_status = EXCLUDED.last_status,
       last_error = EXCLUDED.last_error,
       detail = EXCLUDED.detail,
       updated_at = now()`,
    [syncType, status, error ?? null, detail != null ? JSON.stringify(detail) : null]
  );
}

export async function getSyncRuns(): Promise<SyncRun[]> {
  const res = await pool.query(
    `SELECT sync_type, last_run_at, last_status, last_error, detail, updated_at
     FROM sync_runs ORDER BY sync_type`
  );
  return res.rows;
}
