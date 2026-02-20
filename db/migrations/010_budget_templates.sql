-- Budget Templates: named template sets (e.g., "Show Season", "Winter", "Standard")
-- Replaces the single flat budget_defaults table with reusable named templates

CREATE TABLE IF NOT EXISTS budget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES budget_templates(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE(template_id, category_id, sub_item_id)
);

-- Migrate existing defaults into a "Standard" template
INSERT INTO budget_templates (name, is_default)
VALUES ('Standard', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO budget_template_items (template_id, category_id, sub_item_id, budgeted_amount)
  SELECT (SELECT id FROM budget_templates WHERE name = 'Standard'),
         category_id, sub_item_id, budgeted_amount
  FROM budget_defaults WHERE budgeted_amount > 0;
