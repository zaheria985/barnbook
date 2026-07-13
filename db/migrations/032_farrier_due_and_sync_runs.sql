-- C5: farrier records had no "next due" concept (unlike vaccines), so the most
-- routine equine reminder (~6 week trim/shoe cycle) surfaced nowhere.
ALTER TABLE farrier_records
  ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- C7: persist the last run + outcome of each background sync so failures are
-- visible instead of silently swallowed by the 2h cron.
CREATE TABLE IF NOT EXISTS sync_runs (
  sync_type TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status TEXT NOT NULL,          -- 'success' | 'error'
  last_error TEXT,
  detail JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
