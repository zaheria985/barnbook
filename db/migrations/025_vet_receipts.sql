CREATE TABLE IF NOT EXISTS vet_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_record_id UUID NOT NULL REFERENCES vet_records(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vet_receipts_record ON vet_receipts(vet_record_id);
