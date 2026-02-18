-- Budget Defaults (standard budget template)
-- Same shape as monthly_budgets but without year_month — the single template

CREATE TABLE IF NOT EXISTS budget_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, sub_item_id)
);

INSERT INTO schema_migrations (filename) VALUES ('007_budget_defaults.sql');
