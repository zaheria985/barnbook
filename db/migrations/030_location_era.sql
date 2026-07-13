-- Track when the barn location last changed, to scope footing feedback and
-- accuracy stats to the current location's "era". Old feedback rows are kept
-- but excluded from tuning/accuracy when they predate the move.
-- NULL = no move recorded yet; behaves exactly as before (no cutoff).
ALTER TABLE weather_settings
  ADD COLUMN IF NOT EXISTS location_changed_at TIMESTAMPTZ;
