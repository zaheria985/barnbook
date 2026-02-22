-- Barnbook Budget Tracker - Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  weight_lbs DECIMAL(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Horses (must be before budget_category_sub_items for FK)
CREATE TABLE IF NOT EXISTS horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight_lbs DECIMAL(6,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Categories
CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Category Sub-Items
CREATE TABLE IF NOT EXISTS budget_category_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  horse_id UUID REFERENCES horses(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Monthly Budgets
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year_month, category_id, sub_item_id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  amount DECIMAL(10,2) NOT NULL,
  vendor TEXT,
  date DATE NOT NULL,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Income Sources
CREATE TABLE IF NOT EXISTS income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly Income
CREATE TABLE IF NOT EXISTS monthly_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,
  source_id UUID NOT NULL REFERENCES income_sources(id),
  projected_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year_month, source_id)
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly Balances (IMPORTANT: includes is_closed from Metis review)
CREATE TABLE IF NOT EXISTS monthly_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL UNIQUE,
  total_budgeted DECIMAL(10,2) NOT NULL,
  total_spent DECIMAL(10,2) NOT NULL,
  total_income_actual DECIMAL(10,2) NOT NULL,
  total_sales DECIMAL(10,2) NOT NULL,
  previous_deficit DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_result DECIMAL(10,2) NOT NULL,
  savings_contribution DECIMAL(10,2) NOT NULL DEFAULT 0,
  savings_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 0,
  deficit_carryover DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ride Sessions
CREATE TABLE IF NOT EXISTS ride_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id),
  horse_id UUID NOT NULL REFERENCES horses(id),
  date DATE NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  walk_minutes INTEGER NOT NULL DEFAULT 0,
  trot_minutes INTEGER NOT NULL DEFAULT 0,
  canter_minutes INTEGER NOT NULL DEFAULT 0,
  distance_miles DECIMAL(5,2),
  rider_calories_burned INTEGER,
  horse_mcal_expended DECIMAL(5,2),
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Horse Savings Account
CREATE TABLE IF NOT EXISTS horse_savings_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  start_time TIME,
  end_time TIME,
  location TEXT,
  entry_due_date DATE,
  notes TEXT,
  checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  reminder_uid TEXT,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
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
  reminder_uid TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detection Keywords
CREATE TABLE IF NOT EXISTS detection_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  suggested_event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ride Schedule
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
  rain_window_hours INTEGER NOT NULL DEFAULT 48,
  cold_alert_temp_f INTEGER NOT NULL DEFAULT 25,
  heat_alert_temp_f INTEGER NOT NULL DEFAULT 95,
  wind_cutoff_mph INTEGER NOT NULL DEFAULT 30,
  has_indoor_arena BOOLEAN NOT NULL DEFAULT false,
  footing_caution_inches DECIMAL(4,2) NOT NULL DEFAULT 0.25,
  footing_danger_inches DECIMAL(4,2) NOT NULL DEFAULT 0.75,
  footing_dry_hours_per_inch INTEGER NOT NULL DEFAULT 60,
  auto_tune_drying_rate BOOLEAN NOT NULL DEFAULT true,
  last_tuned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weather Prediction Snapshots
CREATE TABLE IF NOT EXISTS weather_prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  score TEXT NOT NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  predicted_moisture DECIMAL(5,2),
  predicted_hours_to_dry INTEGER,
  forecast_day_f INTEGER,
  forecast_high_f INTEGER,
  forecast_rain_inches DECIMAL(4,2),
  forecast_clouds_pct INTEGER,
  forecast_wind_mph INTEGER,
  drying_rate_at_time INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Footing Feedback
CREATE TABLE IF NOT EXISTS footing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  ride_session_id UUID REFERENCES ride_sessions(id) ON DELETE SET NULL,
  actual_footing TEXT NOT NULL CHECK (actual_footing IN ('good', 'soft', 'unsafe')),
  predicted_score TEXT,
  predicted_moisture DECIMAL(5,2),
  drying_rate_at_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blanket Reminders
CREATE TABLE IF NOT EXISTS blanket_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  overnight_low_f INTEGER NOT NULL,
  reminder_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treatment Schedules
CREATE TABLE IF NOT EXISTS treatment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  horse_id UUID REFERENCES horses(id) ON DELETE CASCADE,
  frequency_days INTEGER NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  occurrence_count INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Treatment Reminders
CREATE TABLE IF NOT EXISTS treatment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES treatment_schedules(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  reminder_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, due_date)
);

-- Vendor Mappings
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags
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

-- Entity Tags (join table)
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

-- Budget Templates
CREATE TABLE IF NOT EXISTS budget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Template Items
CREATE TABLE IF NOT EXISTS budget_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES budget_templates(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE(template_id, category_id, sub_item_id)
);

-- iCloud Settings
CREATE TABLE IF NOT EXISTS icloud_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  read_calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  write_calendar_id TEXT,
  write_reminders_calendar_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- iCloud Sync State (dedup tracking)
CREATE TABLE IF NOT EXISTS icloud_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ical_uid TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  calendar_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suggested Ride Windows
CREATE TABLE IF NOT EXISTS suggested_ride_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  weather_score TEXT NOT NULL,
  weather_notes TEXT[] NOT NULL DEFAULT '{}',
  ical_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, start_time)
);

-- Schema Migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
