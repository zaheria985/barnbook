-- Add footing condition settings for moisture accumulation model
ALTER TABLE weather_settings
  ADD COLUMN IF NOT EXISTS footing_caution_inches DECIMAL(4,2) NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS footing_danger_inches DECIMAL(4,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS footing_dry_hours_per_inch INTEGER NOT NULL DEFAULT 60;

-- Update rain_window_hours default to 48 for moisture lookback
ALTER TABLE weather_settings
  ALTER COLUMN rain_window_hours SET DEFAULT 48;
