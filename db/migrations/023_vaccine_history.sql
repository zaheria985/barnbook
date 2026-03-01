CREATE TABLE IF NOT EXISTS vaccine_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_administered DATE NOT NULL,
  next_due_date DATE,
  provider TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vaccine_records_horse ON vaccine_records(horse_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_records_date ON vaccine_records(date_administered DESC);
