CREATE TABLE IF NOT EXISTS vet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  provider TEXT,
  reason TEXT,
  notes TEXT,
  cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vet_records_horse ON vet_records(horse_id);
CREATE INDEX IF NOT EXISTS idx_vet_records_date ON vet_records(visit_date DESC);
