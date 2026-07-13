-- A2: category-level monthly_budgets rows (sub_item_id IS NULL) never collided
-- on the old UNIQUE(year_month, category_id, sub_item_id) constraint because
-- Postgres treats NULLs as distinct, so repeated "Apply Template" duplicated
-- them and inflated totals. Dedupe existing rows, then rebuild the constraint
-- with NULLS NOT DISTINCT so ON CONFLICT collides on category-level rows too.

-- Keep the lowest id for each (month, category, sub_item) group.
DELETE FROM monthly_budgets a
USING monthly_budgets b
WHERE a.year_month = b.year_month
  AND a.category_id = b.category_id
  AND a.sub_item_id IS NOT DISTINCT FROM b.sub_item_id
  AND a.id > b.id;

-- Drop the old NULL-distinct uniqueness (constraint or index form) and replace
-- it with a NULLS NOT DISTINCT unique index on the same columns. ON CONFLICT
-- (year_month, category_id, sub_item_id) still infers this index.
ALTER TABLE monthly_budgets
  DROP CONSTRAINT IF EXISTS monthly_budgets_year_month_category_id_sub_item_id_key;
DROP INDEX IF EXISTS monthly_budgets_year_month_category_id_sub_item_id_key;
DROP INDEX IF EXISTS monthly_budgets_unique_line;

CREATE UNIQUE INDEX IF NOT EXISTS monthly_budgets_unique_line
  ON monthly_budgets (year_month, category_id, sub_item_id) NULLS NOT DISTINCT;

-- A5: persist email receipts that fail to parse (or arrive misconfigured) so
-- they are reviewable instead of vanishing with only a console error.
CREATE TABLE IF NOT EXISTS failed_ingests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  reason TEXT NOT NULL,
  raw_payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS failed_ingests_unresolved_idx
  ON failed_ingests (created_at DESC) WHERE resolved = false;
