-- Add horse_id to budget_category_sub_items to link horses to budget tracking
ALTER TABLE budget_category_sub_items
  ADD COLUMN IF NOT EXISTS horse_id UUID REFERENCES horses(id) ON DELETE SET NULL;

-- Remove the old hardcoded "Horse A", "Horse B", "Horse C" sub-items
-- that have no expenses referencing them
DELETE FROM budget_category_sub_items
WHERE label IN ('Horse A', 'Horse B', 'Horse C')
  AND horse_id IS NULL
  AND id NOT IN (SELECT DISTINCT sub_item_id FROM expenses WHERE sub_item_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT sub_item_id FROM monthly_budgets WHERE sub_item_id IS NOT NULL);
