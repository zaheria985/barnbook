-- Phase 2: Ride Tracking tables

CREATE TABLE IF NOT EXISTS horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight_lbs DECIMAL(6,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id),
  horse_id UUID NOT NULL REFERENCES horses(id),
  date DATE NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  walk_minutes INTEGER NOT NULL DEFAULT 0,
  trot_minutes INTEGER NOT NULL DEFAULT 0,
  canter_minutes INTEGER NOT NULL DEFAULT 0,
  distance_miles DECIMAL(5,2),
  rider_calories_burned INTEGER,
  horse_mcal_expended DECIMAL(5,2),
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
