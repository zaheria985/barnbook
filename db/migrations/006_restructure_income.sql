-- 006_restructure_income.sql
-- Restructure income from flat sources to category/sub-item hierarchy

BEGIN;

-- 1. Rename income_sources → income_categories
ALTER TABLE income_sources RENAME TO income_categories;

-- 2. Create income_sub_items table
CREATE TABLE income_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_sub_items_category ON income_sub_items(category_id);

-- 3. Add category_id and sub_item_id columns to monthly_income
ALTER TABLE monthly_income ADD COLUMN category_id UUID REFERENCES income_categories(id);
ALTER TABLE monthly_income ADD COLUMN sub_item_id UUID REFERENCES income_sub_items(id);

-- 4. Backfill category_id from existing source_id
UPDATE monthly_income SET category_id = source_id;

-- 5. Make category_id NOT NULL after backfill
ALTER TABLE monthly_income ALTER COLUMN category_id SET NOT NULL;

-- 6. Drop old source_id column and its constraint
ALTER TABLE monthly_income DROP CONSTRAINT IF EXISTS monthly_income_year_month_source_id_key;
ALTER TABLE monthly_income DROP CONSTRAINT IF EXISTS monthly_income_source_id_fkey;
ALTER TABLE monthly_income DROP COLUMN source_id;

-- 7. Add new unique constraint
CREATE UNIQUE INDEX idx_monthly_income_unique ON monthly_income(year_month, category_id, COALESCE(sub_item_id, '00000000-0000-0000-0000-000000000000'));

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('006') ON CONFLICT DO NOTHING;

COMMIT;
