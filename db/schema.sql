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

-- Horse Savings Account
CREATE TABLE IF NOT EXISTS horse_savings_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schema Migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
