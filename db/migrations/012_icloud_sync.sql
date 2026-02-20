-- iCloud calendar settings (which calendars to read/write)
CREATE TABLE IF NOT EXISTS icloud_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  read_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  write_calendar_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track which iCloud events we've already seen (dedup)
CREATE TABLE IF NOT EXISTS icloud_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ical_uid TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  calendar_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suggested ride windows (recalculated each sync)
CREATE TABLE IF NOT EXISTS suggested_ride_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  weather_score TEXT NOT NULL,
  weather_notes TEXT[] NOT NULL DEFAULT '{}',
  ical_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, start_time)
);
