-- Link farrier records to the expense that paid for the visit, so the
-- "create a record from this farrier expense" prompt can tell exactly which
-- expenses already have records (instead of date-fuzzy matching).
ALTER TABLE farrier_records
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_farrier_records_expense_id
  ON farrier_records(expense_id)
  WHERE expense_id IS NOT NULL;
