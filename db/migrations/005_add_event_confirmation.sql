-- Add is_confirmed to events for digest confirmation tracking
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT false;
