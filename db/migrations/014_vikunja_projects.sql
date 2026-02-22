CREATE TABLE vikunja_project_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,  -- 'event_checklists' | 'weather_alerts'
  project_id INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
