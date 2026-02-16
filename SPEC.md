# Barnbook - Technical Specification

> Equestrian management app: budget tracking, ride logging, calendar/weather intelligence, and checklist automation.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Data Models](#data-models)
4. [Screens & UI](#screens--ui)
5. [API Routes](#api-routes)
6. [Integrations](#integrations)
7. [Build Phases](#build-phases)

---

## Overview

### What It Is

Barnbook is a self-hosted web-first app (with a thin native iOS wrapper for Apple Watch features) that combines:

- **Budget Tracker** — Monthly horse expense budgeting with surplus/deficit carryover and a "Horse Savings Account"
- **Ride Tracker** — Session logging with gait breakdown, calorie burn, and horse Mcal expenditure
- **Calendar & Weather** — "Good riding day" scoring, event management, and proactive calendar intelligence
- **Checklist System** — Template-based checklists that auto-push to Apple Reminders via Vikunja

### Who It's For

A family of riders managing multiple horses. Multi-user accounts with individual profiles.

### Key Constraints

- Self-hosted (Docker + PostgreSQL)
- Must integrate with existing Vikunja instance (shared with harmony-homeschool, separate project)
- Web-first for desktop bulk entry; thin native iOS layer for Watch/HealthKit only
- No social features
- Map visualization is nice-to-have, not required

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (app router, standalone) | Match harmony-homeschool |
| Runtime | Node 20 | Match harmony-homeschool |
| Language | TypeScript | Strict mode |
| Database | PostgreSQL 16 | Docker container |
| Data Access | Raw SQL via `pg` Pool | Match harmony-homeschool (no ORM) |
| Auth | NextAuth.js + Credentials | Email/password, bcrypt, family accounts |
| Styling | Tailwind CSS | Match harmony-homeschool |
| Charts | Recharts or Chart.js | Pie charts, bar charts |
| Weather | Apple WeatherKit REST API | Free tier (500K calls/mo) |
| Calendar Sync | Vikunja REST API | Reuse lib/vikunja.ts pattern |
| Email Ingestion | Inbound SMTP receiver (Maddy or Postfix + script) | Venmo receipt parsing |
| Native iOS | Capacitor or SwiftUI shell | Watch, HealthKit, CoreMotion only |
| Infra | Docker multi-stage + docker-compose | Same pattern as harmony-homeschool |

### Reference Implementation

Reuse patterns from `/home/claude/projects/code/harmony-homeschool/`:

- `lib/vikunja.ts` — Vikunja REST API wrapper
- `lib/actions/vikunja-sync.ts` — Sync orchestrator pattern
- `lib/queries/vikunja-sync.ts` — Mapping table queries
- `lib/db.ts` — PostgreSQL pool pattern
- `lib/auth.ts` — NextAuth credentials flow
- `db/migrate.js` — Migration runner
- `db/bootstrap.js` — Bootstrap flow

---

## Data Models

### Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  weight_lbs DECIMAL(5,1),  -- for calorie calculations
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Horses

```sql
CREATE TABLE horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight_lbs DECIMAL(6,1),  -- for Mcal calculations
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Budget Categories

```sql
CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g. "Board", "Farrier Care"
  is_system BOOLEAN NOT NULL DEFAULT false, -- true for default categories
  is_custom BOOLEAN NOT NULL DEFAULT false, -- true for user-created
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sub-items for categories like Board (per-horse amounts)
CREATE TABLE budget_category_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                   -- e.g. "Horse A", "Trainer X"
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

Default system categories (seeded):

| Category | Has Sub-Items | Sub-Item Type |
|----------|--------------|---------------|
| Board | Yes | Per-horse (Horse A, Horse B, Horse C) |
| Farrier Care | No | — |
| Veterinary Care | No | — |
| Additional Feed | No | — |
| Clipping | No | — |
| Lessons | Yes | Per-trainer tag |
| Sitting/Care | Yes | Per-sitter tag |
| Tack & Equipment | No | — |
| Shows & Fees | No | — |

### Monthly Budgets

```sql
CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,              -- "2026-03"
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year_month, category_id, sub_item_id)
);
```

### Expenses

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  amount DECIMAL(10,2) NOT NULL,
  vendor TEXT,
  date DATE NOT NULL,
  notes TEXT,
  source TEXT DEFAULT 'manual',          -- 'manual' | 'venmo_email'
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Income Sources

```sql
CREATE TABLE income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g. "Salary", "Horse Sales"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monthly_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,              -- "2026-03"
  source_id UUID NOT NULL REFERENCES income_sources(id),
  projected_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year_month, source_id)
);
```

### Sales Income (separate from regular income)

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Month-End Balances

```sql
CREATE TABLE monthly_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL UNIQUE,       -- "2026-03"
  total_budgeted DECIMAL(10,2) NOT NULL,
  total_spent DECIMAL(10,2) NOT NULL,
  total_income_actual DECIMAL(10,2) NOT NULL,
  total_sales DECIMAL(10,2) NOT NULL,
  previous_deficit DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_result DECIMAL(10,2) NOT NULL,     -- surplus (+) or deficit (-)
  savings_contribution DECIMAL(10,2) NOT NULL DEFAULT 0,  -- amount added to savings
  savings_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 0,    -- amount pulled from savings
  deficit_carryover DECIMAL(10,2) NOT NULL DEFAULT 0,     -- carried to next month
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE horse_savings_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Month-end calculation logic:

```
net = total_income_actual + total_sales - total_spent - previous_deficit

if net > 0:
  savings_contribution = net
  deficit_carryover = 0

if net < 0:
  if savings_balance >= abs(net):
    savings_withdrawal = abs(net)
    deficit_carryover = 0
  else:
    savings_withdrawal = savings_balance
    deficit_carryover = abs(net) - savings_balance
```

### Vendor Mapping (for Venmo auto-categorize)

```sql
CREATE TABLE vendor_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL,          -- e.g. "John Smith" (from Venmo)
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  sub_item_id UUID REFERENCES budget_category_sub_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_pattern)
);
```

### Ride Sessions

```sql
CREATE TABLE ride_sessions (
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
  source TEXT DEFAULT 'manual',          -- 'manual' | 'watch'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Calorie/Mcal Calculation Constants

```
Rider calories per minute by gait:
  Walk:   3.5 cal/min (adjusted by rider weight)
  Trot:   5.5 cal/min
  Canter: 8.0 cal/min

Formula: calories = sum(gait_minutes * gait_rate * (rider_weight_lbs / 150))

Horse Mcal per hour by gait (adjusted by horse weight):
  Walk:   1.5 Mcal/hr
  Trot:   4.5 Mcal/hr
  Canter: 9.0 Mcal/hr

Formula: mcal = sum(gait_minutes / 60 * gait_rate * (horse_weight_lbs / 1100))
```

### Ride Schedule (recurring available windows)

```sql
CREATE TABLE ride_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL,          -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Events

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,              -- 'show', 'vet', 'farrier', 'lesson', 'pony_club', 'other'
  start_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  notes TEXT,
  entry_due_date DATE,                   -- for shows: when entries are due
  checklist_template_id UUID REFERENCES checklist_templates(id),
  vikunja_task_id BIGINT,                -- mapping to Vikunja
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Checklist Templates

```sql
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g. "Show Prep"
  event_type TEXT,                       -- auto-suggest for this event type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  days_before_event INTEGER,             -- offset from event date (negative = before)
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Per-template reminder schedule
CREATE TABLE checklist_template_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL           -- e.g. 14, 7, 3, 0
);
```

### Event Checklists (instances of templates)

```sql
CREATE TABLE event_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  vikunja_task_id BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Calendar Intelligence Keywords

```sql
CREATE TABLE detection_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,          -- e.g. "show", "rally", "clinic"
  suggested_event_type TEXT,             -- auto-map to event_type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Vikunja Mapping (same pattern as harmony-homeschool)

```sql
CREATE TABLE vikunja_task_map (
  vikunja_task_id BIGINT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id),
  checklist_id UUID REFERENCES event_checklists(id),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('event', 'checklist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Weather Settings

```sql
CREATE TABLE weather_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_lat DECIMAL(9,6) NOT NULL,
  location_lng DECIMAL(9,6) NOT NULL,
  hard_rain_cutoff_inches DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  hard_rain_lookback_hours INTEGER NOT NULL DEFAULT 24,
  soft_rain_low_inches DECIMAL(3,1) NOT NULL DEFAULT 0.3,
  soft_rain_high_inches DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  soft_rain_lookback_hours INTEGER NOT NULL DEFAULT 48,
  dried_out_sun_hours DECIMAL(3,1) NOT NULL DEFAULT 6.0,
  dried_out_wind_mph DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  cold_blanket_threshold_f INTEGER NOT NULL DEFAULT 30,
  too_cold_to_ride_f INTEGER NOT NULL DEFAULT 20,
  min_ride_window_hours INTEGER NOT NULL DEFAULT 3,
  has_indoor_arena BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Screens & UI

### Navigation

Bottom tab bar (mobile) / sidebar (desktop):

1. **Budget** — expense entry, charts, month view
2. **Rides** — ride log, session entry
3. **Calendar** — events, weather, ride-day scoring
4. **Settings** — profiles, horses, templates, weather config, keywords

### Budget Screens

#### B1: Monthly Overview (default view)

- **Header**: Month selector (< Feb 2026 >)
- **Horse Savings Account**: Prominent card at top showing balance
- **Previous Month Balance**: If negative, show as separate line "Carried from Jan: -$200"
- **Category Cards**: Each category shows budgeted vs spent with progress bar
  - Board expands to show per-horse sub-items
  - Lessons shows per-trainer breakdown
- **Totals Footer**: Total budgeted | Total spent | Net
- **Pie Chart Toggle**: Tap to see pie chart by category
- **Budget vs Actual Chart**: Bar chart comparing budgeted vs actual per category
- **FAB**: "+" button → quick expense entry

#### B2: Quick Expense Entry (mobile)

- Amount (numeric keypad, auto-focus)
- Date (defaults to today)
- Category (picker with recent categories first)
- Sub-item (if applicable — which horse, which trainer)
- Vendor (text input with autocomplete from past entries)
- Notes (optional)
- Save button

#### B3: Bulk Entry Table (desktop)

- Spreadsheet-style table with columns: Date | Category | Sub-Item | Vendor | Amount | Notes
- Inline editing
- Paste from clipboard support
- Add row button
- Bulk save

#### B4: Income Management

- Income sources list with projected + actual per source
- Add/edit income source
- Sales income entry (separate "Add Sale" button)

#### B5: Month-End Review

- Summary: total income + sales - total spent - previous deficit = net result
- Shows where money goes: savings contribution or deficit carryover
- "Close Month" action → calculates and locks month, carries to next

### Ride Screens

#### R1: Ride Log

- List of recent ride sessions, grouped by date
- Each entry shows: horse name, duration, gait breakdown icons, calories
- Filter by horse, date range

#### R2: Log Ride (manual entry)

- Rider (auto-selected based on logged-in user)
- Horse (picker from horse profiles)
- Date (defaults to today)
- Total duration
- Walk / Trot / Canter minutes (sliders or numeric input, must sum to total)
- Distance (optional)
- Notes (optional)
- Auto-calculated: rider calories, horse Mcal (shown live as you enter gaits)
- Save button

#### R3: Ride Statistics

- Weekly/monthly ride summary
- Total time per gait (pie chart)
- Calories burned over time (line chart)
- Per-horse breakdown

### Calendar Screens

#### C1: Calendar View

- Month calendar with event dots
- Ride-day scoring overlay (green/yellow/red on each day)
- Tap day → see events + weather + available ride windows
- Weather forecast row: 7-day with temp + precipitation

#### C2: Event Detail / Create

- Title, event type, dates, location
- Entry due date (for shows)
- Template picker → auto-populate checklist
- Checklist items with due dates and completion checkboxes
- "Push to Reminders" button (syncs to Vikunja)

#### C3: Weekly Digest

- Notification-triggered screen
- "We found N upcoming events that might need prep"
- Each detected event: title, date, source calendar
- Actions per event: "Yes, it's a horse event" → guided flow | "Not relevant" → dismiss

#### C4: Weather Dashboard

- Current conditions
- "Good Riding Days" this week (green/yellow/red)
- Available ride windows (from schedule minus calendar conflicts)
- Active alerts (severe weather, cold night blanket reminders)
- Footing assessment

### Settings Screens

#### S1: Profile Management

- User profiles (name, email, weight)
- Family member list
- Add/invite family member

#### S2: Horse Profiles

- List of horses (name, weight)
- Add/edit horse

#### S3: Budget Settings

- Category management (add custom, reorder)
- Sub-item management (add trainers, sitters)
- Income source management

#### S4: Checklist Templates

- Template list
- Create/edit template: name, event type, items, reminder schedule
- Default templates seeded: Show Prep, Vet Visit, Farrier

#### S5: Weather Settings

- Location (auto-detect or manual)
- All threshold sliders (rain cutoffs, cold alerts, etc.)
- Indoor arena toggle
- Ride schedule editor (recurring weekly windows)

#### S6: Calendar Intelligence

- Keyword list (add/remove/edit)
- Keyword → event type mapping
- Digest frequency (weekly)

#### S7: Integrations

- Vikunja connection settings (URL, token, project ID)
- Email ingestion address display
- WeatherKit status

---

## API Routes

### Auth

```
POST /api/auth/[...nextauth]    -- NextAuth handler
```

### Budget

```
GET    /api/budget/overview?month=2026-03
GET    /api/budget/categories
POST   /api/budget/categories              -- create custom category
PUT    /api/budget/categories/:id
DELETE /api/budget/categories/:id

GET    /api/budget/monthly?month=2026-03   -- budgeted amounts for month
PUT    /api/budget/monthly                 -- set/update budget for category+month

GET    /api/expenses?month=2026-03&category=:id
POST   /api/expenses                       -- create expense
POST   /api/expenses/bulk                  -- bulk create (desktop table)
PUT    /api/expenses/:id
DELETE /api/expenses/:id

GET    /api/income?month=2026-03
POST   /api/income/sources
PUT    /api/income/monthly                 -- set projected/actual for source+month

POST   /api/sales                          -- add sale income
GET    /api/sales?month=2026-03

GET    /api/budget/balance?month=2026-03   -- month-end balance summary
POST   /api/budget/close-month             -- calculate and close month

GET    /api/budget/savings                 -- horse savings account balance
```

### Rides

```
GET    /api/rides?rider=:id&horse=:id&from=:date&to=:date
POST   /api/rides                          -- log ride session
PUT    /api/rides/:id
DELETE /api/rides/:id

GET    /api/rides/stats?period=month&date=2026-03
```

### Horses

```
GET    /api/horses
POST   /api/horses
PUT    /api/horses/:id
DELETE /api/horses/:id
```

### Calendar & Events

```
GET    /api/events?from=:date&to=:date
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id

GET    /api/events/:id/checklist
POST   /api/events/:id/checklist           -- apply template
PUT    /api/events/:id/checklist/:itemId   -- toggle complete
```

### Checklist Templates

```
GET    /api/templates
POST   /api/templates
PUT    /api/templates/:id
DELETE /api/templates/:id
```

### Weather

```
GET    /api/weather/forecast               -- current + 7-day
GET    /api/weather/ride-days?from=:date&to=:date  -- scored ride windows
GET    /api/weather/alerts                 -- active severe weather + blanket alerts
GET    /api/weather/settings
PUT    /api/weather/settings
```

### Calendar Intelligence

```
GET    /api/calendar-intel/digest          -- weekly detected events
POST   /api/calendar-intel/confirm/:eventId -- confirm as horse event
POST   /api/calendar-intel/dismiss/:eventId
GET    /api/calendar-intel/keywords
POST   /api/calendar-intel/keywords
DELETE /api/calendar-intel/keywords/:id
```

### Ride Schedule

```
GET    /api/schedule
POST   /api/schedule
PUT    /api/schedule/:id
DELETE /api/schedule/:id
GET    /api/schedule/windows?from=:date&to=:date  -- available windows (schedule minus calendar conflicts)
```

### Vikunja Sync

```
POST   /api/sync/vikunja                   -- trigger sync of events + checklists to Vikunja
GET    /api/sync/status                    -- sync health check
```

### Email Ingestion

```
POST   /api/email/ingest                   -- webhook endpoint for incoming email
GET    /api/email/pending                  -- parsed but uncategorized entries
PUT    /api/email/pending/:id/approve      -- approve auto-categorized expense
```

### Vendor Mappings

```
GET    /api/vendors
POST   /api/vendors                        -- create vendor → category mapping
PUT    /api/vendors/:id
DELETE /api/vendors/:id
```

---

## Integrations

### Vikunja (Shared Instance)

**Pattern**: Reuse harmony-homeschool's `lib/vikunja.ts` wrapper.

- Barnbook gets its own `VIKUNJA_PROJECT_ID` (separate from harmony-homeschool)
- Events and checklist items pushed as Vikunja tasks
- Checklist due dates set on tasks → appear in Apple Reminders with "due this week" / "due today"
- Mapping table `vikunja_task_map` tracks local ↔ Vikunja IDs
- Sync runs on: event create, checklist apply, manual trigger, and cron (every 15 min)

### WeatherKit REST API

**Setup**: Requires Apple Developer account (already have one).

- Generate WeatherKit JWT using developer credentials
- Endpoints: `https://weatherkit.apple.com/api/v1/weather/{lang}/{lat}/{lng}`
- Data used: hourly forecast, daily forecast, weather alerts, precipitation history
- Cache responses (15-min TTL) to stay within free tier

### Email Ingestion (Venmo)

**Flow**:

1. Configure inbound email address: `barnbook@yourdomain.com`
2. Mail receiver (Maddy or Postfix) accepts email
3. Script parses Venmo receipt HTML for: amount, date, recipient name
4. Hits `/api/email/ingest` with parsed data
5. App matches recipient against `vendor_mappings` table
6. If match found → auto-create expense with category
7. If no match → create pending expense, notify user to categorize
8. On user categorize → offer to save vendor mapping for future

### Apple Watch (Phase 2, Native)

**Capabilities**:

- CoreMotion: accelerometer data for gait detection (walk/trot/canter classification)
- CoreLocation: GPS tracking when cellular available
- HealthKit: heart rate, calories
- WatchConnectivity: sync session data to phone → web app API

---

## Build Phases

### Phase 1: Budget Tracker

**Priority**: HIGH (spreadsheet is dying)

**Scope**:
- [ ] Project scaffolding (Next.js 14, PostgreSQL, Docker, auth)
- [ ] Database schema: users, budget_categories, budget_category_sub_items, monthly_budgets, expenses, income_sources, monthly_income, sales, monthly_balances, horse_savings_account
- [ ] Seed default budget categories with sub-items
- [ ] Auth: NextAuth with family accounts (register, login, profile)
- [ ] Budget overview screen (B1) with month selector
- [ ] Horse Savings Account display
- [ ] Previous month deficit display
- [ ] Quick expense entry (B2) - mobile optimized
- [ ] Bulk entry table (B3) - desktop optimized
- [ ] Category management (add custom categories, sub-items)
- [ ] Income management (B4) - sources, projected, actual
- [ ] Sales income entry
- [ ] Pie chart: spending by category
- [ ] Bar chart: budget vs actual per category
- [ ] Month-end close logic with surplus → savings / deficit → carryover
- [ ] Responsive design (mobile + desktop)

**Acceptance Criteria**:
- User can register, log in, manage profile
- User can set monthly budgets per category with sub-items (board per horse, lessons per trainer)
- User can quickly enter expenses on mobile (< 15 seconds per entry)
- User can bulk-enter expenses on desktop via spreadsheet-like table
- User can add sales income that offsets monthly budget
- Month-end close correctly calculates surplus/deficit, moves money to/from savings
- Deficit carries forward visibly as a separate line item
- Charts render correctly on mobile and desktop

### Phase 2: Ride Tracking

**Scope**:
- [ ] Database schema: horses, ride_sessions
- [ ] Horse profile management (S2)
- [ ] Manual ride logging (R2) with gait breakdown
- [ ] Calorie burn + Mcal calculation (auto-calculated on entry)
- [ ] Ride log view (R1) with filters
- [ ] Ride statistics (R3) with charts
- [ ] Apple Watch companion app (gait detection, GPS, HR, session sync)

**Acceptance Criteria**:
- User can create horse profiles with name and weight
- User can log a ride with horse, duration, walk/trot/canter, distance
- Calories and Mcal auto-calculate based on rider weight, horse weight, and gait times
- Ride history filterable by horse and date range
- Statistics show weekly/monthly summaries with charts

### Phase 3: Calendar, Weather & Checklists

**Scope**:
- [ ] Database schema: events, checklist_templates, checklist_template_items, checklist_template_reminders, event_checklists, detection_keywords, ride_schedule, weather_settings, vikunja_task_map, vendor_mappings
- [ ] Seed default checklist templates (Show Prep, Vet Visit, Farrier)
- [ ] Event CRUD with calendar view (C1, C2)
- [ ] Checklist template management (S4)
- [ ] Apply template to event → auto-populate checklist with due dates
- [ ] Vikunja sync: push events + checklist items as tasks with due dates
- [ ] WeatherKit integration: forecast, precipitation history
- [ ] Weather rules engine (green/yellow/red scoring)
- [ ] Ride schedule management (recurring weekly windows)
- [ ] Available ride windows (schedule minus calendar conflicts, weather-scored)
- [ ] Cold night blanket alert (push notification when < 30F overnight)
- [ ] Severe weather alerts
- [ ] Calendar intelligence: keyword scanning, weekly digest, guided event creation
- [ ] Email ingestion: Venmo receipt parsing, vendor matching, auto-categorize

**Acceptance Criteria**:
- User can create events with type, dates, entry deadlines
- User can apply checklist template → items auto-populate with correct due dates
- Checklists sync to Vikunja → appear in Apple Reminders with progressive due dates
- Weather dashboard shows 7-day forecast with ride-day scoring
- Cold night alerts fire when forecast shows < 30F between 8pm-8am
- Available ride windows account for schedule, calendar conflicts, and weather
- Weekly digest detects calendar events matching user keywords and prompts for classification
- Venmo emails auto-parse and create expense entries with correct category

---

## Weather Rules Engine

### Decision Priority (highest to lowest)

| # | Rule | Signal | Message |
|---|------|--------|---------|
| 1 | NWS severe weather alert active | RED | "Severe weather alert - do not ride" |
| 2 | Real-feel < 20F during ride window | RED | "Dangerously cold - skip today" |
| 3 | Rain forecasted during ride window | YELLOW | "Rain expected during ride time" |
| 4 | > 1 inch rain in last 24hrs | YELLOW | "Heavy recent rain - footing may be poor" |
| 5 | 0.3-1 inch in last 48hrs + overcast | YELLOW | "Footing may be iffy" |
| 6 | 0.3-1 inch in last 48hrs + sunny/windy | GREEN | "Should be dried out" |
| 7 | Temp < 30F between 8pm-8am | PUSH | "Cold tonight - blanket your horses" |
| 8 | No upper temp limit | — | No heat block |

All thresholds user-configurable in Settings (S5).

---

## Docker Compose (Target)

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - barnbook_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: barnbook
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: barnbook

  app:
    build: .
    ports:
      - "${APP_PORT:-3100}:3000"
    environment:
      DATABASE_URL: postgresql://barnbook:${DB_PASSWORD}@db:5432/barnbook
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      VIKUNJA_URL: ${VIKUNJA_URL}
      VIKUNJA_API_TOKEN: ${VIKUNJA_API_TOKEN}
      VIKUNJA_PROJECT_ID: ${VIKUNJA_PROJECT_ID}
      WEATHERKIT_KEY_ID: ${WEATHERKIT_KEY_ID}
      WEATHERKIT_TEAM_ID: ${WEATHERKIT_TEAM_ID}
      WEATHERKIT_SERVICE_ID: ${WEATHERKIT_SERVICE_ID}
      WEATHERKIT_PRIVATE_KEY: ${WEATHERKIT_PRIVATE_KEY}
      EMAIL_INGEST_SECRET: ${EMAIL_INGEST_SECRET}
    depends_on:
      - db

volumes:
  barnbook_data:
```

---

## Environment Variables

| Variable | Required | Phase | Description |
|----------|----------|-------|-------------|
| DATABASE_URL | Yes | 1 | PostgreSQL connection string |
| NEXTAUTH_SECRET | Yes | 1 | NextAuth session encryption key |
| NEXTAUTH_URL | Yes | 1 | App base URL |
| DB_PASSWORD | Yes | 1 | PostgreSQL password |
| VIKUNJA_URL | Phase 3 | 3 | Vikunja instance URL |
| VIKUNJA_API_TOKEN | Phase 3 | 3 | Vikunja Bearer token |
| VIKUNJA_PROJECT_ID | Phase 3 | 3 | Barnbook's Vikunja project ID |
| WEATHERKIT_KEY_ID | Phase 3 | 3 | Apple WeatherKit key |
| WEATHERKIT_TEAM_ID | Phase 3 | 3 | Apple Developer team ID |
| WEATHERKIT_SERVICE_ID | Phase 3 | 3 | WeatherKit service identifier |
| WEATHERKIT_PRIVATE_KEY | Phase 3 | 3 | WeatherKit private key (base64) |
| EMAIL_INGEST_SECRET | Phase 3 | 3 | Shared secret for email webhook |
