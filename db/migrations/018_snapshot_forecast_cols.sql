-- Add forecast columns to weather_prediction_snapshots
-- These were added to migration 009 after the table was already created,
-- so CREATE TABLE IF NOT EXISTS skipped them.

ALTER TABLE weather_prediction_snapshots
  ADD COLUMN IF NOT EXISTS forecast_day_f INTEGER,
  ADD COLUMN IF NOT EXISTS forecast_high_f INTEGER,
  ADD COLUMN IF NOT EXISTS forecast_rain_inches DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS forecast_clouds_pct INTEGER,
  ADD COLUMN IF NOT EXISTS forecast_wind_mph INTEGER,
  ADD COLUMN IF NOT EXISTS drying_rate_at_time INTEGER;

-- Backfill drying_rate_at_time for existing rows (non-nullable in code)
UPDATE weather_prediction_snapshots
  SET drying_rate_at_time = 0
  WHERE drying_rate_at_time IS NULL;
