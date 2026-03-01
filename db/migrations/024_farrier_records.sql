CREATE TABLE IF NOT EXISTS farrier_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  provider TEXT,
  service_type TEXT DEFAULT 'trim',
  findings TEXT,
  notes TEXT,
  cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farrier_records_horse ON farrier_records(horse_id);
CREATE INDEX IF NOT EXISTS idx_farrier_records_date ON farrier_records(visit_date DESC);
