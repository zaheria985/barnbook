-- Phase 3: Calendar, Weather & Checklists tables

-- Checklist Templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checklist Template Items
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  days_before_event INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Checklist Template Reminders
CREATE TABLE IF NOT EXISTS checklist_template_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  entry_due_date DATE,
  notes TEXT,
  checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  vikunja_task_id TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Checklists (instantiated from templates)
CREATE TABLE IF NOT EXISTS event_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  vikunja_task_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detection Keywords (for calendar intelligence)
CREATE TABLE IF NOT EXISTS detection_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  suggested_event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ride Schedule (weekly recurring slots)
CREATE TABLE IF NOT EXISTS ride_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weather Settings
CREATE TABLE IF NOT EXISTS weather_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_lat DECIMAL(9,6),
  location_lng DECIMAL(9,6),
  rain_cutoff_inches DECIMAL(4,2) NOT NULL DEFAULT 0.25,
  rain_window_hours INTEGER NOT NULL DEFAULT 4,
  cold_alert_temp_f INTEGER NOT NULL DEFAULT 25,
  heat_alert_temp_f INTEGER NOT NULL DEFAULT 95,
  wind_cutoff_mph INTEGER NOT NULL DEFAULT 30,
  has_indoor_arena BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vikunja Task Map
CREATE TABLE IF NOT EXISTS vikunja_task_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vikunja_task_id TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES event_checklists(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'push',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendor Mappings (for email ingestion auto-categorization)
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default checklist templates

-- Show Prep
INSERT INTO checklist_templates (id, name, event_type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Show Prep', 'show');

INSERT INTO checklist_template_items (template_id, title, days_before_event, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Submit entry form', 14, 1),
  ('00000000-0000-0000-0000-000000000001', 'Confirm stall reservation', 10, 2),
  ('00000000-0000-0000-0000-000000000001', 'Check coggins & health papers', 7, 3),
  ('00000000-0000-0000-0000-000000000001', 'Clean & organize tack', 3, 4),
  ('00000000-0000-0000-0000-000000000001', 'Bathe horse', 1, 5),
  ('00000000-0000-0000-0000-000000000001', 'Braid mane & tail', 1, 6),
  ('00000000-0000-0000-0000-000000000001', 'Pack trailer', 1, 7),
  ('00000000-0000-0000-0000-000000000001', 'Load hay, feed & water', 0, 8);

INSERT INTO checklist_template_reminders (template_id, days_before) VALUES
  ('00000000-0000-0000-0000-000000000001', 14),
  ('00000000-0000-0000-0000-000000000001', 3),
  ('00000000-0000-0000-0000-000000000001', 1);

-- Vet Visit
INSERT INTO checklist_templates (id, name, event_type) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Vet Visit', 'vet');

INSERT INTO checklist_template_items (template_id, title, days_before_event, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Confirm appointment time', 3, 1),
  ('00000000-0000-0000-0000-000000000002', 'Note any symptoms or concerns', 2, 2),
  ('00000000-0000-0000-0000-000000000002', 'Ensure horse is accessible in stall/paddock', 0, 3),
  ('00000000-0000-0000-0000-000000000002', 'Have health records available', 0, 4),
  ('00000000-0000-0000-0000-000000000002', 'Ask about follow-up schedule', 0, 5);

INSERT INTO checklist_template_reminders (template_id, days_before) VALUES
  ('00000000-0000-0000-0000-000000000002', 3),
  ('00000000-0000-0000-0000-000000000002', 1);

-- Farrier
INSERT INTO checklist_templates (id, name, event_type) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Farrier', 'farrier');

INSERT INTO checklist_template_items (template_id, title, days_before_event, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Confirm farrier appointment', 2, 1),
  ('00000000-0000-0000-0000-000000000003', 'Clean hooves day before', 1, 2),
  ('00000000-0000-0000-0000-000000000003', 'Have horse in stall or accessible area', 0, 3),
  ('00000000-0000-0000-0000-000000000003', 'Note any hoof concerns to discuss', 0, 4);

INSERT INTO checklist_template_reminders (template_id, days_before) VALUES
  ('00000000-0000-0000-0000-000000000003', 2);

-- Seed default weather settings (single row)
INSERT INTO weather_settings (id) VALUES ('00000000-0000-0000-0000-000000000010');

-- Seed default detection keywords
INSERT INTO detection_keywords (keyword, suggested_event_type) VALUES
  ('show', 'show'),
  ('horse show', 'show'),
  ('hunter', 'show'),
  ('jumper', 'show'),
  ('dressage', 'show'),
  ('vet', 'vet'),
  ('veterinary', 'vet'),
  ('vaccination', 'vet'),
  ('farrier', 'farrier'),
  ('shoeing', 'farrier'),
  ('trim', 'farrier'),
  ('lesson', 'lesson'),
  ('clinic', 'lesson'),
  ('pony club', 'pony_club'),
  ('rally', 'pony_club');
