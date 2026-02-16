-- Seed default budget categories
INSERT INTO budget_categories (name, is_system, sort_order) VALUES
  ('Board', true, 1),
  ('Farrier Care', true, 2),
  ('Veterinary Care', true, 3),
  ('Additional Feed', true, 4),
  ('Clipping', true, 5),
  ('Lessons', true, 6),
  ('Sitting/Care', true, 7),
  ('Tack & Equipment', true, 8),
  ('Shows & Fees', true, 9)
ON CONFLICT DO NOTHING;

-- Sub-items for Board (per-horse)
INSERT INTO budget_category_sub_items (category_id, label, sort_order)
SELECT id, 'Horse A', 1 FROM budget_categories WHERE name = 'Board' AND is_system = true
ON CONFLICT DO NOTHING;
INSERT INTO budget_category_sub_items (category_id, label, sort_order)
SELECT id, 'Horse B', 2 FROM budget_categories WHERE name = 'Board' AND is_system = true
ON CONFLICT DO NOTHING;
INSERT INTO budget_category_sub_items (category_id, label, sort_order)
SELECT id, 'Horse C', 3 FROM budget_categories WHERE name = 'Board' AND is_system = true
ON CONFLICT DO NOTHING;

-- Sub-items for Lessons (per-trainer placeholder)
INSERT INTO budget_category_sub_items (category_id, label, sort_order)
SELECT id, 'Trainer', 1 FROM budget_categories WHERE name = 'Lessons' AND is_system = true
ON CONFLICT DO NOTHING;

-- Sub-items for Sitting/Care (per-sitter placeholder)
INSERT INTO budget_category_sub_items (category_id, label, sort_order)
SELECT id, 'Sitter', 1 FROM budget_categories WHERE name = 'Sitting/Care' AND is_system = true
ON CONFLICT DO NOTHING;

-- Seed Horse Savings Account with balance = 0
INSERT INTO horse_savings_account (balance) VALUES (0)
ON CONFLICT DO NOTHING;
