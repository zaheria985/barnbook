-- Universal Tags System
-- Tags can be of type 'vendor' (with auto-categorization defaults) or 'label' (general purpose)

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag_type TEXT NOT NULL DEFAULT 'label',
  color TEXT,
  default_category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  default_sub_item_id UUID REFERENCES budget_category_sub_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, tag_type)
);

CREATE TABLE IF NOT EXISTS entity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);

-- Add vendor_tag_id to expenses (nullable, for linking to vendor tags)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_tag_id UUID REFERENCES tags(id) ON DELETE SET NULL;

-- Migrate vendor_mappings → vendor tags
INSERT INTO tags (name, tag_type, default_category_id, default_sub_item_id)
  SELECT vendor_pattern, 'vendor', category_id, sub_item_id
  FROM vendor_mappings
ON CONFLICT (name, tag_type) DO NOTHING;
