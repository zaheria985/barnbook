# Barnbook Feature Specification

**Project:** Barnbook — Self-hosted equestrian management app
**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-28

---

## Overview

Barnbook is a self-hosted equestrian management application for tracking horses, events, rides, budgets, income, weather conditions, and calendar integrations. It runs as a Docker Compose stack with a Next.js 14 frontend, PostgreSQL database, Radicale CalDAV server, and a cron service for iCloud sync. The app is single-tenant (one user per instance) and designed for a horse owner managing daily barn operations, ride tracking, event preparation, and equestrian budgeting.

---

## Stack & Deployment

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS with CSS custom property design tokens |
| Database | PostgreSQL 16 (direct SQL via `pg`, no ORM) |
| Auth | NextAuth.js v4 (Credentials Provider, JWT sessions) |
| CalDAV | tsdav library (iCloud + Radicale) |
| Weather | OpenWeatherMap One Call 3.0 |
| Charts | Recharts |
| Tables | TanStack React Table |
| Deployment | Docker Compose — 4 services: app (port 3500), db (postgres:16-alpine), radicale, cron (alpine) |
| Build | Multi-stage Dockerfile (node:20-slim), standalone output, runs `db/bootstrap.js && db/migrate.js && server.js` |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing key |
| `NEXTAUTH_URL` | Yes | App URL for NextAuth callbacks |
| `OPENWEATHERMAP_API_KEY` | No | Weather API (One Call 3.0) |
| `ICLOUD_APPLE_ID` | No | Apple ID for CalDAV sync |
| `ICLOUD_APP_PASSWORD` | No | App-specific password for iCloud |
| `ICLOUD_SYNC_SECRET` | No | Bearer token for cron sync calls |
| `EMAIL_INGEST_SECRET` | No | Bearer token for email webhook |
| `RADICALE_URL` | No | Self-hosted CalDAV server URL |
| `RADICALE_USER` | No | Radicale auth username |
| `RADICALE_PASSWORD` | No | Radicale auth password |
| `SEED_DEFAULT_USER` | No | Set to `1` to bootstrap default user on first run |
| `POSTGRES_USER` | Yes | Database user (Docker) |
| `POSTGRES_PASSWORD` | Yes | Database password (Docker) |

---

## File Organization

```
app/                  # Pages (client components with "use client")
  auth/               # Login, register
  budget/             # Overview, entry, bulk, expenses, income, pending, vendors, close
  calendar/           # Events, digest, weather
  rides/              # Ride entry, history
  settings/           # Consolidated settings (4 tabs)
  api/                # Route handlers
    auth/             # NextAuth, register, profile
    budget/           # Categories, monthly, templates, balance, close, reopen, trends, yearly
    calendar-intel/   # Digest, confirm, dismiss, ride windows, keywords
    email/            # Ingest webhook, pending
    events/           # CRUD, checklists
    expenses/         # Vendor spending
    footing-feedback/ # Submit + accuracy
    horses/           # CRUD
    income/           # Categories, monthly, sub-items
    sales/            # CRUD
    schedule/         # Ride slots
    sync/             # iCloud, reminders, Radicale
    tags/             # CRUD, match
    templates/        # Checklist templates
    vendors/          # CRUD, match
    weather/          # Settings, forecast, ride-days, alerts
components/
  settings/           # Section components (Profile, Horses, Weather, Keywords, Categories, etc.)
  ui/                 # Reusable components (Modal, TagPicker, etc.)
lib/
  auth.ts             # NextAuth configuration
  caldav.ts           # iCloud CalDAV client
  radicale.ts         # Radicale CalDAV client
  openweathermap.ts   # Weather API client
  weather-rules.ts    # Ride day scoring engine
  footing-tuner.ts    # Auto-tune drying rate
  email-parser.ts     # Receipt email parsing
  db.ts               # PostgreSQL pool
  queries/            # Domain query files (horses, events, rides, budget, income, etc.)
db/
  schema.sql          # Full schema
  migrations/         # Numbered SQL migrations
  bootstrap.js        # DB initialization
  migrate.js          # Migration runner
  seed-default-user.sql
middleware.ts         # Route protection (JWT check)
docker-compose.yml    # 4-service stack
Dockerfile            # Multi-stage build
```

---

## Database Schema Overview

All primary keys are UUIDs. All foreign keys are indexed. Timestamps use `TIMESTAMPTZ`. Monetary values use `DECIMAL(10,2)`. The schema is managed through numbered SQL migrations in `db/migrations/`. Single-row config tables (`weather_settings`, `icloud_settings`) store app-wide settings. The `users` table is the auth root; `created_by` and `rider_id` foreign keys reference it for audit trails.

---

## Table of Contents

1. [Horse Management](#feature-1-horse-management)
2. [Calendar & Events](#feature-2-calendar--events)
3. [Ride Tracking](#feature-3-ride-tracking)
4. [Budget System](#feature-4-budget-system)
5. [Income & Sales](#feature-5-income--sales)
6. [Weather Intelligence](#feature-6-weather-intelligence)
7. [CalDAV Sync & Reminders](#feature-7-caldav-sync--reminders)
8. [Email Ingestion & Calendar Intel](#feature-8-email-ingestion--calendar-intel)
9. [Vendors & Tags](#feature-9-vendors--tags)
10. [Authentication](#feature-10-authentication)
11. [Settings](#feature-11-settings)

---

## Feature 1: Horse Management

### Summary

Horse Management handles CRUD operations for horses in the barn. Each horse has a name and optional weight (used for metabolic calorie calculations in ride tracking). Horses are managed in the Settings > Barn tab. When a horse is added, the system automatically creates per-horse budget sub-items under predefined categories (Board, Farrier Care, Veterinary Care, Additional Feed, Clipping). Deleting a horse is blocked if it has associated ride sessions, events, or budget expenses.

### Goals

- Maintain a list of horses with names and optional weights
- Auto-create per-horse budget sub-items on horse creation
- Prevent deletion of horses with associated data

### Out of Scope

- Breed, age, or registration tracking
- Medical or health record management
- Horse profile pages

### Future Scope

- **Vet records** — upload and store veterinary records per horse, including visit date, provider, and notes
- **Visit receipts** — attach receipt images or PDFs to vet visits
- **Vaccine history** — track vaccinations with dates, next-due reminders, and provider info
- **Farrier records** — log farrier visits by date with notes on findings
- **Horse profile photos and detailed attributes** — profile image, breed, age, color, registration info
- **Horse profile page** — dedicated page per horse showing all associated data

### Data Model

**`horses`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Required |
| `weight_lbs` | DECIMAL(7,1) | Nullable — used for metabolic calorie calculations |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Horse-linked sub-items are stored in `budget_category_sub_items` with a `horse_id` FK. The `PER_HORSE_CATEGORIES` constant defines which budget categories get auto-created sub-items: Board, Farrier Care, Veterinary Care, Additional Feed, Clipping.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/horses` | List all horses |
| `POST` | `/api/horses` | Create horse `{ name, weight_lbs? }` — triggers `syncHorseBudgetSubItems()` |
| `PUT` | `/api/horses/[id]` | Update horse `{ name?, weight_lbs? }` |
| `DELETE` | `/api/horses/[id]` | Delete horse — blocked if has rides, events, or expenses |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/settings?tab=barn` | HorsesSection | Horse list with add/edit/delete; inline edit modal for name and weight |

### Key Behaviors

- **Auto budget sync** — `syncHorseBudgetSubItems()` runs after create/delete to ensure each horse has sub-items under all `PER_HORSE_CATEGORIES` categories
- **Safe delete** — deletion checks for associated ride sessions, events, and budget expenses; returns error with counts if any exist
- **Weight for calories** — horse weight feeds into metabolic calorie (MCal) calculations in ride tracking; defaults to 1100 lbs baseline if not set

---

## Feature 2: Calendar & Events

### Summary

The Calendar & Events system manages equestrian events (shows, vet visits, farrier appointments, lessons, pony club meets, rides, and other). Events have a date, optional time range, location, notes, horse assignment, and event type. Events support checklist templates that auto-populate preparation items with due dates calculated from the event date. Events can be confirmed or unconfirmed (auto-detected from iCloud). The calendar page shows a monthly view with event cards color-coded by type.

### Goals

- Full CRUD for equestrian events with type-based organization
- Checklist templates with date-relative item activation
- Monthly calendar view with color-coded event cards
- Support confirmed and unconfirmed (auto-detected) events

### Out of Scope

- Recurring event series
- Multi-day event rendering (events span a single date)
- File attachments on events

### Future Scope

- **Clinic event type** — add `clinic` to the event type enum
- **Recurring events** — auto-generate event series on a schedule
- **Event attachments** — file/image uploads on events
- **Multi-day event rendering** — display events spanning multiple calendar days

### Data Model

**`events`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `title` | TEXT | Required |
| `event_type` | TEXT | show, vet, farrier, lesson, pony_club, ride, other |
| `start_date` | DATE | Required |
| `end_date` | DATE | Nullable |
| `start_time` | TIME | Nullable |
| `end_time` | TIME | Nullable |
| `location` | TEXT | Nullable |
| `notes` | TEXT | Nullable |
| `horse_id` | UUID | FK → horses, nullable |
| `is_confirmed` | BOOLEAN | Default true; false for auto-detected |
| `reminder_uid` | TEXT | CalDAV VTODO UID |
| `created_by` | UUID | FK → users |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`event_checklists`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `event_id` | UUID | FK → events (cascade delete) |
| `title` | TEXT | Item description |
| `is_completed` | BOOLEAN | Default false |
| `due_date` | DATE | Calculated: event date − days_before_event |
| `sort_order` | INTEGER | |
| `reminder_uid` | TEXT | CalDAV VTODO UID |
| `created_at` | TIMESTAMPTZ | |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/events?month=YYYY-MM` | List events for month (with horse name joined) |
| `POST` | `/api/events` | Create event — auto-applies matching checklist template |
| `GET` | `/api/events/[id]` | Get event with checklists |
| `PUT` | `/api/events/[id]` | Update event fields |
| `DELETE` | `/api/events/[id]` | Delete event (cascades checklists) |
| `PUT` | `/api/events/[id]/checklists/[checklistId]` | Toggle checklist item completion |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/calendar` | Calendar page | Monthly grid view with event cards color-coded by type; prev/next month navigation; click to create/edit events |

### Key Behaviors

- **Checklist template application** — on event creation, if a checklist template matches the event type, items are instantiated with due dates via SQL date math (`event_date - days_before_event`)
- **Event type badges** — each type has a distinct color: show, vet, farrier, lesson, pony_club, ride, other
- **Unconfirmed events** — auto-detected from iCloud sync arrive as `is_confirmed = false`; user confirms or dismisses from the digest
- **Reminder sync** — confirmed events with checklists get pushed as VTODO items to iCloud/Radicale; completion status can be pulled back

---

## Feature 3: Ride Tracking

### Summary

Ride Tracking records ride sessions with duration, gait breakdown (walk, trot, canter minutes), horse assignment, and optional notes. The system calculates estimated calories burned for both rider and horse using gait-specific metabolic rates scaled by body weight. Rider calorie calculations use walk 3.5, trot 5.5, canter 8.0 MCal/hr (baseline 150 lbs). Horse calorie calculations use walk 1.5, trot 4.5, canter 9.0 MCal/hr (baseline 1100 lbs). The rides page shows an entry form and a history list with per-ride stats.

### Goals

- Record ride sessions with gait breakdown and horse assignment
- Calculate rider and horse calories from gait rates and body weights
- Display ride history with stats

### Out of Scope

- GPS tracking or route mapping
- Training plans or progression tracking
- Multi-rider ride logging

### Data Model

**`ride_sessions`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `horse_id` | UUID | FK → horses, nullable |
| `rider_id` | UUID | FK → users |
| `date` | DATE | Required |
| `duration_minutes` | INTEGER | Total ride time |
| `walk_minutes` | INTEGER | Default 0 |
| `trot_minutes` | INTEGER | Default 0 |
| `canter_minutes` | INTEGER | Default 0 |
| `notes` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Calorie values are computed at query time, not stored.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/rides?month=YYYY-MM` | List rides for month with horse name joined |
| `POST` | `/api/rides` | Create ride session `{ horse_id?, date, duration_minutes, walk_minutes, trot_minutes, canter_minutes, notes? }` |
| `GET` | `/api/rides/[id]` | Get single ride |
| `PUT` | `/api/rides/[id]` | Update ride |
| `DELETE` | `/api/rides/[id]` | Delete ride |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/rides/entry` | Ride entry page | Form with date, horse dropdown, duration, gait breakdown sliders/inputs, notes; shows calculated calories on save |
| `/rides` | Ride history page | List of rides with date, horse, duration, gait breakdown, calories; month filter |

### Key Behaviors

- **Gait rate constants** — `RIDER_GAIT_RATES`: walk 3.5, trot 5.5, canter 8.0; `HORSE_GAIT_RATES`: walk 1.5, trot 4.5, canter 9.0 (MCal/hr)
- **Weight scaling** — rider calories scale by `actual_weight / 150`; horse calories scale by `actual_weight / 1100`; if weight not set, baseline is used (scaling factor = 1.0)
- **Calorie calculation** — for each gait: `(minutes / 60) * rate * weight_factor`; total is sum across gaits
- **Duration validation** — `walk_minutes + trot_minutes + canter_minutes` must equal `duration_minutes`

---

## Feature 4: Budget System

### Summary

The Budget System tracks equestrian expenses organized by categories and optional sub-items. Categories can be custom or system-generated (per-horse categories like Board, Farrier Care). Monthly budgets set spending targets per category/sub-item. Default budgets auto-copy to new months on first access. Named templates provide reusable budget presets. Expenses are logged with amount, date, vendor, category, and optional notes. Month-end close locks a month's data and applies the net result (income + sales − spending) to a running horse savings account balance. Closed months can be reopened, reversing the savings adjustment.

### Goals

- Organize expenses by categories with optional sub-items
- Set monthly budget targets with defaults and templates
- Track expenses with vendor tagging and auto-categorization
- Month-end close/reopen with savings account tracking

### Out of Scope

- Multi-currency support
- Receipt image uploads
- Budget sharing or export

### Future Scope

- **Income trends visualization** — graphs on the income page showing actual income over time (month-over-month trends)

### Data Model

**`budget_categories`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Required |
| `is_system` | BOOLEAN | True for auto-generated horse categories |
| `is_custom` | BOOLEAN | True for user-created |
| `sort_order` | INTEGER | Display order |
| `created_at` | TIMESTAMPTZ | |

**`budget_category_sub_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `category_id` | UUID | FK → budget_categories |
| `label` | TEXT | Required |
| `horse_id` | UUID | FK → horses, nullable — set for auto-created per-horse items |
| `sort_order` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

**`monthly_budgets`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `year_month` | TEXT | YYYY-MM format |
| `category_id` | UUID | FK → budget_categories |
| `sub_item_id` | UUID | FK → budget_category_sub_items, nullable |
| `budgeted_amount` | DECIMAL(10,2) | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`expenses`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `category_id` | UUID | FK → budget_categories, nullable (null = pending) |
| `sub_item_id` | UUID | FK → budget_category_sub_items, nullable |
| `amount` | DECIMAL(10,2) | Required |
| `date` | DATE | Required |
| `vendor` | TEXT | Nullable |
| `vendor_tag_id` | UUID | FK → tags, nullable |
| `notes` | TEXT | Nullable |
| `source` | TEXT | Nullable — `email`, `venmo_email`, or null (manual) |
| `created_by` | UUID | FK → users |
| `created_at` | TIMESTAMPTZ | |

**`monthly_balances`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `year_month` | TEXT | YYYY-MM, unique |
| `total_budgeted` | DECIMAL(10,2) | |
| `total_spent` | DECIMAL(10,2) | |
| `total_income_actual` | DECIMAL(10,2) | |
| `total_sales` | DECIMAL(10,2) | |
| `net_result` | DECIMAL(10,2) | income + sales − spending |
| `is_closed` | BOOLEAN | Default false |
| `closed_at` | TIMESTAMPTZ | |

**`horse_savings_account`** (single-row)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `balance` | DECIMAL(10,2) | Running total |
| `updated_at` | TIMESTAMPTZ | |

**`budget_templates`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Required |
| `is_default` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

**`budget_template_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `template_id` | UUID | FK → budget_templates |
| `category_id` | UUID | FK → budget_categories |
| `sub_item_id` | UUID | FK → budget_category_sub_items, nullable |
| `budgeted_amount` | DECIMAL(10,2) | |

### API Endpoints

**Categories & Sub-Items**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/budget/categories` | List all categories with sub-items |
| `POST` | `/api/budget/categories` | Create category `{ name }` |
| `PUT` | `/api/budget/categories/[id]` | Update category `{ name?, sort_order? }` |
| `DELETE` | `/api/budget/categories/[id]` | Delete category |
| `POST` | `/api/budget/categories/[id]/sub-items` | Create sub-item `{ label }` |
| `PUT` | `/api/budget/categories/[id]/sub-items/[subId]` | Update sub-item `{ label?, sort_order? }` |
| `DELETE` | `/api/budget/categories/[id]/sub-items/[subId]` | Delete sub-item |

**Monthly Budgets & Defaults**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/budget/monthly?month=YYYY-MM` | Get monthly budgets (auto-copies defaults if empty) |
| `PUT` | `/api/budget/monthly` | Set budget amount `{ yearMonth, categoryId, subItemId?, amount }` |
| `POST` | `/api/budget/monthly/apply-defaults` | Apply defaults to month `{ month, mode: "fill"\|"overwrite" }` |
| `GET` | `/api/budget/defaults` | List default budget amounts |
| `PUT` | `/api/budget/defaults` | Set default amount `{ categoryId, subItemId?, amount }` |

**Templates**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/budget/templates` | List all templates |
| `POST` | `/api/budget/templates` | Create template `{ name }` |
| `PUT` | `/api/budget/templates/[id]` | Rename template `{ name }` |
| `DELETE` | `/api/budget/templates/[id]` | Delete template |
| `GET` | `/api/budget/templates/[id]/items` | Get template line items |
| `PUT` | `/api/budget/templates/[id]/items` | Set template item `{ categoryId, subItemId?, amount }` |
| `POST` | `/api/budget/templates/[id]/apply` | Apply template to month `{ month, mode }` |
| `POST` | `/api/budget/templates/[id]/clone` | Clone template `{ name }` |

**Balance, Close & Analytics**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/budget/balance?month=YYYY-MM` | Get month balance, savings, closed/live status |
| `GET` | `/api/budget/overview?month=YYYY-MM` | Get budget vs spent overview with income totals |
| `GET` | `/api/budget/savings` | Get current savings balance |
| `POST` | `/api/budget/close-month` | Close month `{ month }` — locks and applies net to savings |
| `POST` | `/api/budget/reopen-month` | Reopen month `{ month }` — reverses savings adjustment |
| `GET` | `/api/budget/trends` | Category spending trends across months |
| `GET` | `/api/budget/yearly?year=YYYY` | Yearly summary (omit year to get list of available years) |

All endpoints require NextAuth session authentication.

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/budget` | BudgetOverviewPage | Dashboard with spending pie/bar charts, income overview, savings balance, collapsible category cards (budgeted vs actual), template apply button, and floating FAB for new expenses |
| `/budget/entry` | BudgetEntryPage | Single-expense quick entry — amount (auto-focused), date, category/sub-item dropdowns, vendor tag picker with auto-categorization, notes |
| `/budget/bulk` | BulkExpensePage | Two modes: bulk paste (multiple expenses per line) and quick-add form for rapid successive entries with success feedback |
| `/budget/expenses` | ExpensesPage | Full expense list for selected month — filterable table with vendor, date, category, amount; totals bar at top |
| `/budget/income` | IncomePage | Income management with collapsible categories (projected vs actual), sales tracking, income category manager; combined income + sales total |
| `/budget/pending` | PendingExpensesPage | Review/approve expenses from email ingestion — category dropdown, optional vendor-to-category mapping save, auto-categorization from saved patterns |
| `/budget/vendors` | VendorSpendingPage | Vendor spending summary — transaction count and total per vendor for a month or all-time |
| `/budget/close` | MonthEndClosePage | Month-end review showing income, sales, expenses, net result; close month (locks + updates savings) or reopen previously closed months |

All pages are client components (`"use client"`) that fetch data from the budget API routes. Month selection is available on most pages via `MonthSelector` component.

### Key Behaviors

- **Month-end close** locks all expenses/income for that month and applies the net result (income + sales − spending) to the horse savings account balance
- **Reopen month** reverses the savings adjustment and unlocks the month for further edits
- **Default budgets** auto-copy to a new month on first access; can also be re-applied in "fill" (skip existing) or "overwrite" mode
- **Templates** provide named budget presets that can be applied to any month, cloned, and managed independently from defaults
- **Vendor auto-categorization** — when a vendor tag is selected on expense entry, the system suggests the category based on previously saved vendor-to-category mappings
- **Email ingestion** feeds expenses into a pending queue; pending expenses require manual review/approval before appearing in the budget
- **Horse-linked sub-items** — categories like Board, Farrier Care, Veterinary Care, Additional Feed, and Clipping automatically get per-horse sub-items when horses are added via `syncHorseBudgetSubItems()`
- **Savings account** is a running balance across all months, adjusted only by month close/reopen operations
- **Yearly summary** aggregates all months for a given year; trends endpoint tracks category spending across months

---

## Feature 5: Income & Sales

### Summary

Income & Sales tracks projected and actual income alongside one-off sales (e.g., selling tack). Income is organized into categories with optional sub-items (e.g., "Lessons" category with "Lesson A", "Lesson B" sub-items). Monthly income entries record both projected and actual amounts. Sales are standalone entries with a description, amount, and date. Both income and sales are included in the month-end budget calculation — the net result formula is (total actual income + total sales − total spending). Closed months lock all income and sales edits.

### Goals

- Track projected vs actual income per category/sub-item per month
- Record one-off sales with description and date
- Feed income + sales totals into budget balance calculations
- Respect closed-month locks on all edits

### Out of Scope

- Recurring income auto-generation
- Invoice or payment tracking
- Tax calculations

### Future Scope

- **Income trends visualization** — graphs on the income page showing actual income over time (month-over-month trends)

### Data Model

**`income_categories`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Unique, required |
| `sort_order` | INTEGER | Default 0 |
| `created_at` | TIMESTAMPTZ | |

**`income_sub_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `category_id` | UUID | FK → income_categories (cascade delete) |
| `label` | TEXT | Required |
| `sort_order` | INTEGER | Default 0 |
| `created_at` | TIMESTAMPTZ | |

**`monthly_income`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `year_month` | TEXT | YYYY-MM format |
| `category_id` | UUID | FK → income_categories |
| `sub_item_id` | UUID | FK → income_sub_items, nullable |
| `projected_amount` | DECIMAL(10,2) | Default 0 |
| `actual_amount` | DECIMAL(10,2) | Default 0 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Unique constraint on `(year_month, category_id, COALESCE(sub_item_id, '00000000-...-000000000000'))`.

**`sales`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `description` | TEXT | Required, free-form |
| `amount` | DECIMAL(10,2) | Required |
| `date` | DATE | Required |
| `created_by` | UUID | FK → users, nullable |
| `created_at` | TIMESTAMPTZ | |

### API Endpoints

**Income Categories**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/income/sources` | List categories with nested sub-items |
| `POST` | `/api/income/sources` | Create category `{ name }` |
| `PUT` | `/api/income/sources/[id]` | Update category `{ name?, sort_order? }` |
| `DELETE` | `/api/income/sources/[id]` | Delete category (403 if monthly records exist) |

**Income Sub-Items**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/income/categories/[id]/sub-items` | Create sub-item `{ label }` |
| `PUT` | `/api/income/categories/[id]/sub-items/[subId]` | Update sub-item `{ label?, sort_order? }` |
| `DELETE` | `/api/income/categories/[id]/sub-items/[subId]` | Delete sub-item (403 if referenced) |

**Monthly Income**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/income/monthly?month=YYYY-MM` | Get month's income entries |
| `PUT` | `/api/income/monthly` | Upsert `{ yearMonth, categoryId, subItemId?, projected, actual }` — 403 if month closed |

**Sales**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/sales?month=YYYY-MM` | List month's sales |
| `POST` | `/api/sales` | Create sale `{ description, amount, date }` — 403 if month closed |
| `PUT` | `/api/sales/[id]` | Update sale — 403 if month closed |
| `DELETE` | `/api/sales/[id]` | Delete sale — 403 if month closed |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/budget/income` | IncomePage | Collapsible category list with inline projected/actual inputs (blur-to-save), sales add/list panel, income category manager modal, month selector |

### Key Behaviors

- **Hierarchical categories** — categories can have zero or many sub-items; if sub-items exist, income is tracked per sub-item only; if none, a single entry at category level (sub_item_id = NULL)
- **Upsert on save** — monthly income uses INSERT ON CONFLICT UPDATE, so editing projected or actual amounts is idempotent
- **Category totals** — sum of all monthly income rows for that category across sub-items
- **Grand total** = total actual income + total sales for the month
- **Closed month lock** — all create/edit/delete operations on income and sales check `isMonthClosed()` and return 403 if locked
- **Safe delete** — categories and sub-items cannot be deleted if monthly income records reference them
- **Sort order** — categories and sub-items support reordering via sort_order swaps

---

## Feature 6: Weather Intelligence

### Summary

Weather Intelligence provides ride-day scoring, weather alerts, footing condition tracking, and blanket reminders using OpenWeatherMap One Call 3.0 data. A scoring engine evaluates rain, wind, temperature, and ground moisture for each of the next 7 days, producing green/yellow/red ride-day scores with human-readable reasons. Users configure location, thresholds, and ride schedule slots in settings. A footing feedback loop lets users rate yesterday's actual footing ("good", "soft", "unsafe"), which powers an auto-tuning system that adjusts the evaporation/drying rate model over time. Blanket reminders trigger when overnight lows drop below the cold alert threshold and can write to iCloud Reminders via CalDAV.

### Goals

- Score next 7 days as green/yellow/red for riding suitability
- Track ground moisture with a simulated evaporation model
- Provide cold/heat/wind/rain alerts
- Auto-tune footing predictions from user feedback
- Generate blanket reminders when overnight temps drop below threshold

### Out of Scope

- Real-time radar or map overlays
- Multi-location support
- Historical weather data browsing

### Future Scope

_(none)_

### Data Model

**`weather_settings`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `location_lat` | DECIMAL | Latitude for weather API |
| `location_lng` | DECIMAL | Longitude for weather API |
| `rain_cutoff_inches` | DECIMAL | Default 0.25 — red threshold for daytime rain |
| `rain_window_hours` | INT | Default 48 — lookback for recent rain history |
| `cold_alert_temp_f` | INT | Default 25 — cold alert + blanket threshold |
| `heat_alert_temp_f` | INT | Default 95 — heat alert threshold |
| `wind_cutoff_mph` | INT | Default 30 — red threshold for wind gusts |
| `has_indoor_arena` | BOOLEAN | Default false — downgrades weather-only red → yellow |
| `footing_caution_inches` | DECIMAL | Default 0.25 — yellow moisture threshold |
| `footing_danger_inches` | DECIMAL | Default 0.75 — red moisture threshold |
| `footing_dry_hours_per_inch` | INT | Default 60 — evaporation rate model |
| `auto_tune_drying_rate` | BOOLEAN | Default true |
| `last_tuned_at` | TIMESTAMPTZ | Last auto-tune adjustment |
| `updated_at` | TIMESTAMPTZ | |

**`weather_prediction_snapshots`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `date` | DATE | Unique — one snapshot per date |
| `score` | TEXT | green, yellow, or red |
| `reasons` | TEXT[] | Human-readable scoring reasons |
| `predicted_moisture` | DECIMAL | Ground moisture in inches |
| `predicted_hours_to_dry` | INT | Hours until footing dries |
| `forecast_day_f` | INT | Daytime temperature |
| `forecast_high_f` | INT | High temperature |
| `forecast_rain_inches` | DECIMAL | Expected daily rainfall |
| `forecast_clouds_pct` | INT | Cloud cover percentage |
| `forecast_wind_mph` | INT | Wind speed |
| `drying_rate_at_time` | INT | Snapshot of drying rate used |
| `created_at` | TIMESTAMPTZ | |

**`footing_feedback`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `date` | DATE | Unique — one feedback per date |
| `ride_session_id` | UUID | FK → ride_sessions, nullable |
| `actual_footing` | TEXT | CHECK: good, soft, unsafe |
| `predicted_score` | TEXT | Snapshot of prediction at time of feedback |
| `predicted_moisture` | DECIMAL | Snapshot of predicted moisture |
| `drying_rate_at_time` | INT | Snapshot of drying rate |
| `created_at` | TIMESTAMPTZ | |

**`blanket_reminders`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `date` | DATE | Unique |
| `overnight_low_f` | INT | Overnight low (8pm–9am window) |
| `reminder_uid` | TEXT | iCloud CalDAV VTODO UID |
| `created_at` | TIMESTAMPTZ | |

**`ride_schedule`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `day_of_week` | INT | 0=Sunday through 6=Saturday |
| `start_time` | TIME | Ride slot start |
| `end_time` | TIME | Ride slot end |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`suggested_ride_windows`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `date` | DATE | |
| `start_time` | TIME | Suggested slot start |
| `end_time` | TIME | Suggested slot end |
| `weather_score` | TEXT | green, yellow, red |
| `weather_notes` | TEXT[] | Context notes |
| `avg_temp_f` | INTEGER | Average temp for window |
| `ical_uid` | TEXT | iCloud event reference |
| `created_at` | TIMESTAMPTZ | |

Unique constraint on `(date, start_time)`.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/weather/settings` | Get weather configuration |
| `PUT` | `/api/weather/settings` | Update thresholds/location/footing params — triggers ride-day recalculation |
| `GET` | `/api/weather/forecast` | Fetch OpenWeatherMap forecast (15-min cache) — current + 7-day + hourly |
| `GET` | `/api/weather/ride-days` | Score next 7 days — upserts prediction snapshots, prunes >90 days |
| `GET` | `/api/weather/alerts` | Get current weather alerts (cold, heat, wind, rain, blanket) |
| `GET` | `/api/footing-feedback?date=YYYY-MM-DD` | Get footing feedback for a date |
| `POST` | `/api/footing-feedback` | Submit feedback `{ date, actual_footing, ride_session_id? }` — triggers auto-tune check |
| `GET` | `/api/footing-feedback/accuracy` | Prediction accuracy stats (total, correct, too_conservative, too_aggressive, accuracy_pct) |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/calendar/weather` | Weather Dashboard | Current conditions, active alerts, 7-day ride scores with reasons, scheduled ride events, 7-day forecast cards, yesterday's footing feedback prompt |
| `/settings?tab=barn` | WeatherSection | Location inputs, threshold sliders, footing config (caution/danger/drying rate), auto-tune toggle with accuracy stats, ride schedule manager (add/delete weekly slots) |

### Key Behaviors

- **Scoring engine** (`scoreDays()`) evaluates rain, wind, temperature, and footing for each day — scores escalate green → yellow → red, never downgrade
- **Days 0–1** use hourly data for time-specific reasons (e.g., "Rain 2PM–4PM", "Gusty 10AM–12PM"); **days 2+** use daily aggregates with "timing unavailable" note
- **Footing simulation** models ground moisture using recent rain history + forecast rain, with evaporation based on sun/temp/wind factors; shows moisture level, hours to dry, and rainfall context
- **Indoor arena override** — if `has_indoor_arena` is true and the only red reason is weather (rain/wind), score downgrades to yellow with "Indoor arena available" note; footing issues keep red
- **Blanket check** uses 8pm–9am overnight window from hourly data (falls back to daily low for days 2+); triggers reminders when low ≤ `cold_alert_temp_f`; writes to iCloud Reminders via CalDAV if configured
- **Auto-tuning** runs after each footing feedback submission if enabled, requires ≥5 feedbacks and ≥24h since last tune; adjusts drying rate ±5 hours/inch (clamped 20–120) based on ≥60% directional consensus
- **Prediction snapshots** store score + forecast data per date; enable accuracy tracking and footing feedback comparison; pruned after 90 days
- **OpenWeatherMap caching** — forecast has 15-min TTL, timemachine (historical rain) has 24-hr TTL
- **Known gap: same-day rain** — `getRecentRain()` currently only fetches the previous 2 days from the timemachine API; today's past rainfall is not included in the moisture simulation, only the current precipitation rate. Heavy morning rain won't register in afternoon footing checks. See `high-eq-6xp`.

---

## Feature 7: CalDAV Sync & Reminders

### Summary

Barnbook integrates with CalDAV-compatible services for bidirectional event sync and reminder management. It supports iCloud Calendar (via Apple CalDAV) and Radicale (self-hosted). A cron job runs every 2 hours to scan selected iCloud calendars for equestrian events (keyword-based auto-detection), calculate weather-based ride window suggestions, and push reminders for event checklists, blanket alerts, and treatment schedules. Reminders are written as VTODO items to either iCloud Reminders or Radicale collections. Users configure calendars, reminder lists, and the iCloud/Radicale choice in settings.

### Goals

- Auto-detect equestrian events from iCloud calendars via keyword matching
- Suggest optimal ride windows based on weather scores and calendar conflicts
- Push event checklists, blanket reminders, and treatment reminders as VTODO items
- Support both iCloud and self-hosted Radicale as reminder backends
- Pull checklist completion status back from CalDAV

### Out of Scope

- Full two-way calendar sync (only events are read from iCloud; writes are ride windows and reminders only)
- Google Calendar or other non-CalDAV providers
- Automatic ride window creation without user approval

### Future Scope

_(none)_

### Data Model

**`icloud_settings`** (single-row config)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `read_calendar_ids` | TEXT[] | iCloud calendars to scan for events |
| `write_calendar_id` | TEXT | Calendar to write ride windows to |
| `reminders_checklists_id` | TEXT | iCloud Reminders list for event checklists |
| `reminders_weather_id` | TEXT | iCloud Reminders list for blanket alerts |
| `reminders_treatments_id` | TEXT | iCloud Reminders list for treatment schedules |
| `use_radicale` | BOOLEAN | If true, use Radicale instead of iCloud for reminders |
| `radicale_checklists_collection` | TEXT | Radicale collection URL for checklists |
| `radicale_weather_collection` | TEXT | Radicale collection URL for weather |
| `radicale_treatments_collection` | TEXT | Radicale collection URL for treatments |
| `updated_at` | TIMESTAMPTZ | |

**`icloud_sync_state`** (deduplication tracking)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `ical_uid` | TEXT | Unique — UID from CalDAV event |
| `event_id` | UUID | FK → events, nullable |
| `calendar_id` | TEXT | Source calendar |
| `last_seen_at` | TIMESTAMPTZ | Prevents re-importing deleted events |
| `created_at` | TIMESTAMPTZ | |

**`suggested_ride_windows`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `date` | DATE | |
| `start_time` | TIME | |
| `end_time` | TIME | |
| `weather_score` | TEXT | green, yellow, red |
| `weather_notes` | TEXT[] | Context notes |
| `avg_temp_f` | INTEGER | Average temp for window |
| `ical_uid` | TEXT | If written to iCloud calendar |
| `created_at` | TIMESTAMPTZ | |

Unique constraint on `(date, start_time)`.

**`treatment_reminders`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `schedule_id` | UUID | FK → treatment_schedules |
| `due_date` | DATE | |
| `reminder_uid` | TEXT | CalDAV VTODO UID |
| `created_at` | TIMESTAMPTZ | |

Unique constraint on `(schedule_id, due_date)`.

`blanket_reminders` — documented in Feature 6 (Weather Intelligence).

Reminder UID fields also exist on `events.reminder_uid` and `event_checklists.reminder_uid`.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/sync/icloud` | Main sync job (cron, every 2h) — scans calendars, detects events, pushes reminders, suggests ride windows |
| `POST` | `/api/sync/reminders` | Manually push event + checklist items to CalDAV `{ event_id }` |
| `POST` | `/api/sync/reminders/pull` | Pull checklist completion status back from CalDAV |
| `GET` | `/api/sync/icloud/calendars` | List available iCloud calendars with color and type |
| `GET` | `/api/sync/icloud/settings` | Get current iCloud/Radicale config |
| `PUT` | `/api/sync/icloud/settings` | Update config — clears reminder UIDs if switching iCloud↔Radicale |
| `GET` | `/api/sync/radicale/collections` | List Radicale VTODO collections |
| `POST` | `/api/sync/radicale/collections` | Bootstrap 3 default Radicale collections (Checklists, Weather, Treatments) |
| `GET` | `/api/sync/status` | Check which integrations are configured |

Cron endpoint uses `Authorization: Bearer $ICLOUD_SYNC_SECRET`. All others require NextAuth session.

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/settings?tab=barn` | IntegrationsSection | iCloud calendar picker (read/write calendars, 3 reminder list dropdowns), Radicale toggle with collection pickers and bootstrap button, status badges |

### Key Behaviors

- **Cron sync loop** runs every 2 hours via Alpine cron container — calls `POST /api/sync/icloud` with bearer token auth
- **Event auto-detection** — scans iCloud events against `detection_keywords` table; matches create unconfirmed Barnbook events tracked via `icloud_sync_state` to prevent duplicates
- **Ride window suggestions** — for each forecast day with non-red weather score, generates 3-hour candidate windows (sunrise+1h to sunset-1h), filters out iCloud calendar conflicts, stores in DB; not auto-written to iCloud until user approves
- **Three reminder types** — event checklists, blanket alerts, and treatment schedules each write to their own configurable CalDAV list as VTODO items
- **iCloud ↔ Radicale switching** — when toggling the `use_radicale` flag, all existing reminder UIDs are cleared and reminders are deleted from DB; next cron run re-creates them in the new backend
- **Partial two-way sync** — push is fully automated (events → CalDAV); pull only fetches checklist completion status via `/api/sync/reminders/pull`
- **Noon UTC dates** — all dates use noon UTC via `toNoonUTC()` to avoid timezone shifts (midnight UTC = previous day in US timezones)
- **Stale sync state cleanup** — old `icloud_sync_state` entries pruned after 30 days; old blanket reminders pruned after 7 days

---

## Feature 8: Email Ingestion & Calendar Intel

### Summary

Email ingestion accepts forwarded receipt emails (Venmo and generic) via a webhook, parses amounts/vendors/dates, and creates pending expenses for user review. Vendor-to-category mappings enable auto-categorization of repeat vendors. Separately, the Calendar Intel digest provides a unified 7-day timeline combining confirmed Barnbook events, unconfirmed auto-detected events, iCloud calendar events, and weather-based ride window suggestions. Users can confirm or dismiss suggested events and approve or dismiss ride windows directly from the digest.

### Goals

- Parse forwarded receipt emails into pending budget expenses
- Auto-categorize expenses via saved vendor pattern mappings
- Provide a unified weekly digest of all calendar activity and suggestions
- Allow confirm/dismiss actions on auto-detected events and ride windows

### Out of Scope

- Direct email account integration (IMAP/POP) — relies on external forwarding
- Auto-approval of expenses without user review
- Google Calendar or non-CalDAV event sources

### Future Scope

_(none)_

### Data Model

**`detection_keywords`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `keyword` | TEXT | Lowercased match term |
| `suggested_event_type` | TEXT | show, vet, farrier, lesson, pony_club, ride, other |
| `created_at` | TIMESTAMPTZ | |

**`vendor_mappings`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `vendor_pattern` | TEXT | Case-insensitive ILIKE pattern |
| `category_id` | UUID | FK → budget_categories |
| `sub_item_id` | UUID | FK → budget_category_sub_items, nullable |

Email-sourced expenses use the existing `expenses` table with `source` set to `'email'` or `'venmo_email'`. Uncategorized expenses (`category_id IS NULL`) appear in the pending queue.

`suggested_ride_windows` and `icloud_sync_state` are documented in Feature 7 (CalDAV Sync).

### API Endpoints

**Email Ingestion**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/email/ingest` | Webhook — parses email `{ html, text, subject }`, creates expense; Bearer token auth via `EMAIL_INGEST_SECRET` |
| `GET` | `/api/email/pending` | List uncategorized email expenses |
| `PUT` | `/api/email/pending/[id]/approve` | Categorize pending expense `{ category_id, sub_item_id? }` |

**Calendar Intel**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/calendar-intel/digest` | 7-day digest — unconfirmed events, confirmed events, ride windows, iCloud events, keywords |
| `POST` | `/api/calendar-intel/confirm/[eventId]` | Confirm auto-detected event `{ event_type?, notes? }` |
| `POST` | `/api/calendar-intel/dismiss/[eventId]` | Delete unconfirmed event |
| `POST` | `/api/calendar-intel/ride-window/[windowId]` | Approve ride window — creates confirmed event, writes to iCloud if configured |
| `DELETE` | `/api/calendar-intel/ride-window/[windowId]` | Dismiss ride window — deletes from DB and iCloud |
| `GET` | `/api/calendar-intel/keywords` | List detection keywords |
| `POST` | `/api/calendar-intel/keywords` | Create keyword `{ keyword, suggested_event_type }` |
| `DELETE` | `/api/calendar-intel/keywords/[id]` | Delete keyword |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/calendar/digest` | Digest page | 7-day timeline grouped by date — iCloud events (gray), confirmed events (green), unconfirmed events (blue), suggested ride windows (dashed border with weather color); confirm/dismiss/approve actions per item; "Coming Up" overflow section beyond 7 days |
| `/budget/pending` | PendingExpensesPage | Card per pending expense (amount, vendor, date, source); category dropdown, optional "remember vendor" checkbox to save mapping; approve button |

### Key Behaviors

- **Email parsing** — Venmo receipts parsed first (HTML regex for amount, recipient, memo); falls back to generic parser (first dollar amount + date from text); source field tracks origin
- **Vendor auto-categorization** — on ingest, recipient is matched against `vendor_mappings` via case-insensitive ILIKE; if matched, expense is auto-categorized and skips pending queue
- **Pending review** — uncategorized email expenses (`category_id IS NULL, source IN ('email','venmo_email')`) appear in `/budget/pending`; user selects category and optionally saves vendor mapping for future auto-categorization
- **Digest timeline** — items sorted by time within each day; weather score dot (best score of day's windows) shown in day header; 7-day hard cutoff with overflow section
- **Ride window approval** — creates a confirmed "Ride Window" event in Barnbook, writes to iCloud `write_calendar_id` if configured, deletes the suggestion row
- **Ride window dismissal** — deletes from DB; if window had been written to iCloud (`ical_uid`), also deletes from iCloud
- **Atomic window replacement** — `replaceSuggestedWindows()` uses a transaction to clear and re-insert all windows (no merge, complete replacement each sync cycle)

---

## Feature 9: Vendors & Tags

### Summary

Vendors and tags provide two related systems for organizing budget data. Vendor mappings (legacy) use pattern-based matching to auto-categorize email-ingested expenses. The newer tags system offers a unified tagging model with two types: vendor tags (with default category for auto-categorization) and label tags (general-purpose). Tags support color coding and an entity tagging join table for attaching tags to any entity type. Vendor spending analytics aggregate expenses by vendor name with transaction counts and totals.

### Goals

- Auto-categorize expenses by vendor pattern or vendor tag matching
- Provide a unified tag system for organizing budget entities
- Track vendor spending totals and transaction counts

### Out of Scope

- Tag hierarchies or nesting
- Tag-based reporting beyond vendor spending

### Future Scope

_(none)_

### Data Model

**`tags`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Required |
| `tag_type` | TEXT | `vendor` or `label` — immutable after creation |
| `color` | TEXT | Optional hex color |
| `default_category_id` | UUID | FK → budget_categories, nullable — for vendor auto-categorization |
| `default_sub_item_id` | UUID | FK → budget_category_sub_items, nullable |
| `created_at` | TIMESTAMPTZ | |

Unique constraint on `(name, tag_type)`.

**`entity_tags`** (join table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tag_id` | UUID | FK → tags (cascade delete) |
| `entity_type` | TEXT | Any entity type string |
| `entity_id` | UUID | Target entity |
| `created_at` | TIMESTAMPTZ | |

Unique constraint on `(tag_id, entity_type, entity_id)`. Indexed on `(entity_type, entity_id)` and `(tag_id)`.

**`vendor_mappings`** (legacy, coexists with tags)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `vendor_pattern` | TEXT | Case-insensitive ILIKE pattern |
| `category_id` | UUID | FK → budget_categories |
| `sub_item_id` | UUID | FK → budget_category_sub_items, nullable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Expenses table has `vendor` (TEXT) for display and `vendor_tag_id` (UUID, FK → tags, nullable) for tag linking.

### API Endpoints

**Tags**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tags?type=vendor\|label` | List tags, optional type filter |
| `POST` | `/api/tags` | Create tag `{ name, tagType, color?, defaultCategoryId?, defaultSubItemId? }` |
| `PUT` | `/api/tags/[id]` | Update tag (type is immutable) |
| `DELETE` | `/api/tags/[id]` | Delete tag (cascades from entity_tags) |
| `GET` | `/api/tags/match?vendor=NAME` | Match vendor tag — exact then fuzzy match |

**Vendor Mappings (legacy)**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/vendors` | List all vendor mappings |
| `POST` | `/api/vendors` | Create mapping `{ vendor_pattern, category_id, sub_item_id? }` |
| `PUT` | `/api/vendors/[id]` | Update mapping |
| `DELETE` | `/api/vendors/[id]` | Delete mapping |
| `GET` | `/api/vendors/match?vendor=NAME` | Match vendor string (ILIKE substring) |

**Vendor Spending**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/expenses/vendor-spending?month=YYYY-MM` | Vendor spending summary — transaction count + total per vendor (all-time if month omitted) |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/budget/vendors` | VendorSpendingPage | Vendor spending table with month selector and all-time toggle — vendor name, transaction count, total spent |
| `/settings?tab=budget` | VendorsSection | Manage legacy vendor mappings — pattern, category, sub-item; add/edit/delete |
| `/settings?tab=budget` | TagsSection | Unified tag manager with filter tabs (All/Vendors/Labels); create/edit modal with name, type, color, default category; color-coded tag pills |

### Key Behaviors

- **Two coexisting systems** — legacy vendor mappings (ILIKE substring match) and newer vendor tags (exact then fuzzy match) both work for auto-categorization; migration 011 copied existing mappings into vendor tags
- **Tag type immutability** — `tag_type` (vendor/label) is set at creation and cannot be changed afterward
- **Vendor tag auto-categorization** — vendor tags store `default_category_id` and `default_sub_item_id`; when matched during expense entry, those defaults pre-fill the category
- **Color support** — tags have optional hex color displayed as colored dot indicators and pill backgrounds with opacity
- **Entity tagging infrastructure** — `entity_tags` join table with query functions (`getEntityTags`, `setEntityTags`, `addEntityTag`, `removeEntityTag`) exists but no API routes consume it yet
- **Vendor spending analytics** — aggregates by raw `expenses.vendor` text field (not tag-linked); groups, counts transactions, sums amounts per vendor
- **TagPicker component** — searchable dropdown supporting single/multi-select, on-the-fly tag creation, color-coded pills, filterable by tag type

---

## Feature 10: Authentication

### Summary

Authentication uses NextAuth.js v4 with a Credentials Provider (email + password) and JWT session strategy. Users register with name/email/password, log in via a credentials form, and receive a JWT stored in a secure httpOnly cookie. Middleware protects all app routes, redirecting unauthenticated requests to the login page. The app is single-tenant — one user per instance with no row-level data isolation. A default bootstrap user (`rider@barnbook.local`) is seeded on first run when `SEED_DEFAULT_USER=1` is set.

### Goals

- Secure all app routes behind authentication
- Simple email/password credential flow with JWT sessions
- Support user profile with rider weight for calorie calculations

### Out of Scope

- Multi-user / multi-tenant support
- OAuth providers (Google, GitHub, etc.)
- Email verification or password reset flows

### Future Scope

_(none)_

### Data Model

**`users`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `email` | TEXT | Unique |
| `password_hash` | TEXT | bcrypt (10 rounds) |
| `name` | TEXT | |
| `weight_lbs` | DECIMAL(5,1) | Nullable — rider weight for calorie calculations |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

User-scoped foreign keys: `expenses.created_by`, `events.created_by`, `sales.created_by`, `ride_sessions.rider_id` all reference `users.id`.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST/GET` | `/api/auth/[...nextauth]` | NextAuth handler — sign-in, session, callbacks |
| `POST` | `/api/auth/register` | Create user `{ name, email, password }` — password min 6 chars, 409 on duplicate email |
| `GET` | `/api/auth/profile` | Get profile `{ id, name, email, weight_lbs }` — requires session |
| `PUT` | `/api/auth/profile` | Update profile `{ name, weight_lbs }` — requires session |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/auth/login` | Login page | Email/password form; redirects to `/budget` or `callbackUrl` on success; shows "Account created" banner from registration; links to register |
| `/auth/register` | Register page | Name/email/password/confirm form; client-side validation (6+ chars, match); redirects to login on success; links to login |

### Key Behaviors

- **Middleware** protects `/budget/*`, `/rides/*`, `/calendar/*`, `/settings/*` — checks JWT via `getToken()`, redirects to `/auth/login?callbackUrl=...` if missing/invalid
- **Credentials flow** — `signIn("credentials", ...)` queries user by email, compares password with `bcryptjs.compare()`, returns `{ id, name, email }` on success
- **JWT callbacks** — `jwt` callback adds `token.id = user.id`; `session` callback adds `session.user.id = token.id`
- **API authorization pattern** — all protected routes call `getServerSession(authOptions)` and check `session?.user?.id`, returning 401 if absent
- **Single-tenant** — all data is global scope; `created_by` fields exist for audit trail but no row-level filtering is enforced
- **Bootstrap user** — `rider@barnbook.local` / `barnbook123` seeded via `db/seed-default-user.sql` when `SEED_DEFAULT_USER=1`
- **SessionProvider** — `components/Providers.tsx` wraps the app, enabling `useSession()` in client components

---

## Feature 11: Settings

### Summary

Settings is a consolidated single page (`/settings`) with 4 tabs: Account, Barn, Budget, and System. Each tab contains collapsible accordion sections. Navigation uses the `?tab=` query parameter. Most settings sections manage configuration for features documented elsewhere — this feature documents the page structure, tab organization, and the checklist templates section unique to settings.

### Goals

- Centralize all app configuration into a single tabbed page
- Provide accordion sections for organized, scannable settings
- Manage checklist templates for event preparation workflows

### Out of Scope

- Per-horse settings pages
- Role-based settings access

### Future Scope

_(none)_

### Tab Structure

**Account** (`?tab=account`)
- ProfileSection — name, email (read-only), rider weight (see Feature 10)

**Barn** (`?tab=barn`)
- HorsesSection — horse CRUD with auto-budget sub-items (see Feature 1)
- WeatherSection — location, thresholds, footing config, ride schedule (see Feature 6)
- KeywordsSection — detection keywords for calendar event auto-import (see Feature 8)

**Budget** (`?tab=budget`)
- CategoriesSection — budget category and sub-item management (see Feature 4)
- BudgetDefaultsSection — budget templates with inline editing (see Feature 4)
- VendorsSection — vendor pattern mappings (see Feature 9)
- TagsSection — vendor and label tags (see Feature 9)

**System** (`?tab=system`)
- TemplatesSection — checklist templates for event types
- IntegrationsSection — iCloud CalDAV and Radicale config (see Feature 7)

### Data Model (Checklist Templates)

**`checklist_templates`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | TEXT | Template name |
| `event_type` | TEXT | show, vet, farrier, lesson, pony_club, other |
| `created_at` | TIMESTAMPTZ | |

**`checklist_template_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `template_id` | UUID | FK → checklist_templates |
| `title` | TEXT | Item description |
| `days_before_event` | INTEGER | When item becomes active (days before event date) |
| `sort_order` | INTEGER | Display order |

**`checklist_template_reminders`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `template_id` | UUID | FK → checklist_templates |
| `days_before` | INTEGER | When to send iCloud/Radicale reminder |

### API Endpoints (Checklist Templates)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/templates` | List all checklist templates |
| `POST` | `/api/templates` | Create template `{ name, event_type }` |
| `GET` | `/api/templates/[id]` | Get template with items and reminders |
| `PUT` | `/api/templates/[id]` | Update template `{ name, event_type, items, reminders }` |
| `DELETE` | `/api/templates/[id]` | Delete template |

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/settings` | SettingsPage | Tabbed page with 4 tabs, each containing collapsible accordion sections; tab selected via `?tab=` query param; single-section tabs auto-expand |

### Key Behaviors

- **Accordion pattern** — sections collapse/expand; tabs with only one section auto-expand it
- **Tab navigation** — `?tab=account|barn|budget|system` query param; sidebar has single "Settings" link, mobile nav has 4 tab shortcuts
- **Checklist templates** — items have `days_before_event` for staggered activation; reminders have `days_before` for CalDAV VTODO push timing; items and reminders saved together on template update
- **Template application** — when an event is created with a matching event type, the template's items are instantiated as `event_checklists` rows with due dates calculated from the event date minus `days_before_event`
- **Inline editing** — budget template items use blur-to-save number inputs; categories allow inline rename
- **Integration status badges** — show Connected/Not Configured based on environment variable presence (OpenWeatherMap, Email Ingest, iCloud, Radicale)
