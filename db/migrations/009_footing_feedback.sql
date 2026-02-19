-- Footing feedback loop: prediction snapshots + user feedback + auto-tuning

-- Snapshot ride-day predictions so we can compare against actual feedback
CREATE TABLE IF NOT EXISTS weather_prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  score TEXT NOT NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  predicted_moisture DECIMAL(5,2),
  predicted_hours_to_dry INTEGER,
  forecast_high_f INTEGER,
  forecast_rain_inches DECIMAL(4,2),
  forecast_clouds_pct INTEGER,
  forecast_wind_mph INTEGER,
  drying_rate_at_time INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-reported footing observations
CREATE TABLE IF NOT EXISTS footing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  ride_session_id UUID REFERENCES ride_sessions(id) ON DELETE SET NULL,
  actual_footing TEXT NOT NULL CHECK (actual_footing IN ('good', 'soft', 'unsafe')),
  predicted_score TEXT,
  predicted_moisture DECIMAL(5,2),
  drying_rate_at_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-tuning columns on weather_settings
ALTER TABLE weather_settings
  ADD COLUMN IF NOT EXISTS auto_tune_drying_rate BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_tuned_at TIMESTAMPTZ;
