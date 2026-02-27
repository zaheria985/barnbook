# Barnbook Feature Specification

**Project:** Barnbook
**Version:** 1.0
**Last Updated:** 2026-02-27
**Status:** Active

## Table of Contents

1. [Overview](#overview)
2. [Feature 1: Horse Management](#feature-1-horse-management)
3. [Feature 2: Calendar & Events](#feature-2-calendar--events)
4. [Feature 3: Ride Tracking](#feature-3-ride-tracking)
5. [Feature 4: Budget System](#feature-4-budget-system)
6. [Feature 5: Income & Sales](#feature-5-income--sales)
7. [Feature 6: Weather Intelligence](#feature-6-weather-intelligence)
8. [Feature 7: CalDAV Sync](#feature-7-caldav-sync)
9. [Feature 8: Reminders](#feature-8-reminders)
10. [Feature 9: Email Ingestion & Calendar Intel](#feature-9-email-ingestion--calendar-intel)
11. [Feature 10: Vendors & Tags](#feature-10-vendors--tags)
12. [Feature 11: Authentication](#feature-11-authentication)
13. [Feature 12: Settings](#feature-12-settings)

---

## Overview

Barnbook is a self-hosted equestrian management application for tracking horses, rides, events, weather conditions, and barn finances. It is designed for a single-barn setup running in Docker.

### Stack & Deployment

**Backend**
- Language: TypeScript (Node.js)
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL 16 (direct SQL via `pg` driver, no ORM)
- Authentication: NextAuth (JWT sessions, credentials provider)

**Frontend**
- Type: Client-side interactive SPA pages (`"use client"`)
- Styling: Tailwind CSS with CSS custom property design tokens
- Charts: CSS-only (no chart libraries)
- Design tokens: `var(--interactive)`, `var(--success-text)`, `var(--error-text)`, etc.

**Deployment**
- Docker Compose with PostgreSQL
- Build: `npx next build` (type-checks + compiles)
- Migrations: `npm run db:migrate` (sequential numbered SQL files)

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | (required) | JWT signing secret |
| `NEXTAUTH_URL` | (required) | App base URL |
| `ICLOUD_APPLE_ID` | (optional) | Apple ID for CalDAV sync |
| `ICLOUD_APP_PASSWORD` | (optional) | App-specific password for iCloud |
| `RADICALE_HOST` | (optional) | Self-hosted Radicale server URL |
| `RADICALE_USERNAME` | (optional) | Radicale HTTP auth username |
| `RADICALE_PASSWORD` | (optional) | Radicale HTTP auth password |
| `OPENWEATHERMAP_API_KEY` | (optional) | OpenWeatherMap One Call 3.0 key |

### File Organization

```
app/                  # Pages (all "use client" with API fetch patterns)
  auth/               #   Login, registration
  budget/             #   Overview, entry, expenses, income, vendors, close, bulk, pending
  calendar/           #   Month grid, digest, event CRUD, weather forecast
  horses/             #   Horse detail/edit
  rides/              #   Ride log, entry, statistics
  settings/           #   Consolidated settings (Account, Barn, Budget, System tabs)
app/api/              # REST API routes (Next.js route handlers)
  budget/             #   Categories, balance, close/reopen, templates, trends, yearly
  calendar-intel/     #   Digest, confirm, dismiss, keywords, ride windows
  email/              #   Ingest, pending approvals
  events/             #   CRUD + checklists
  expenses/           #   CRUD + bulk + vendor spending
  horses/             #   CRUD
  income/             #   Sources, sub-items, monthly
  rides/              #   CRUD + stats
  sales/              #   CRUD
  schedule/           #   Ride schedule slots + windows
  sync/               #   iCloud, Radicale, reminders
  tags/               #   CRUD + match
  treatments/         #   CRUD
  vendors/            #   CRUD + match
  weather/            #   Forecast, alerts, ride-days, settings
components/           # UI components by domain
  budget/             #   CategoryCard, ExpenseTable, charts, MonthSelector, etc.
  calendar/           #   MonthGrid, DayCell, EventCard, ChecklistView
  rides/              #   RideCard, GaitBreakdown
  settings/           #   Tab section components
  ui/                 #   Card, Badge, Modal, StatCard, ProgressBar, TagPicker
lib/                  # Core libraries
  auth.ts             #   NextAuth configuration
  caldav.ts           #   iCloud/Radicale CalDAV client
  db.ts               #   PostgreSQL connection pool
  openweathermap.ts   #   Weather API client
  weather-rules.ts    #   Ride scoring engine
lib/queries/          # Database query functions by domain (27 files)
db/migrations/        # Sequential numbered SQL migrations (001-021)
```

### Database Schema Overview

Core chain: **users** own **horses**, track **ride_sessions** and **events** (with **event_checklists**). The **budget system** has **budget_categories** with **budget_category_sub_items** (linked to horses), **expenses**, **monthly_budgets**, and **monthly_balances** for closing months. **Weather** data flows through **weather_settings**, **weather_prediction_snapshots**, and **footing_feedback**. **CalDAV sync** is managed via **icloud_settings** and **icloud_sync_state**. **Reminders** are written as VTODO to CalDAV -- **treatment_reminders**, **blanket_reminders**, and event checklist items each store a `reminder_uid`.

---

## Feature 1: Horse Management

### Summary

Horse Management tracks the horses in the barn. Each horse has a name and weight. When a horse is created, budget sub-items are automatically generated under per-horse budget categories (Board, Farrier, Vet, Supplements) so expenses can be tracked per horse. Horses are referenced by ride sessions, treatment schedules, and budget line items throughout the app.

### Goals

- Maintain a roster of horses with names and weights
- Auto-generate budget sub-items when horses are added so per-horse costs are tracked from day one
- Provide horse weight for MCal expenditure calculations during rides

### Out of Scope

- Horse health records or medical history (treatments are schedule-based only)
- Horse profile photos or detailed attributes (breed, color, age)

### Future Scope

- **Horse profile page** -- Currently horses are managed only in Settings > Barn tab. A dedicated `/horses/[id]` page exists but shows a simple edit form; could be expanded to show ride history, expense totals, treatment timeline, and health notes for that horse
- **Multi-barn support** -- Horses belong to a single implicit barn; no barn_id scoping exists

### Data Model

**horses**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Horse name (required) |
| weight_lbs | NUMERIC | Horse weight in pounds (for MCal calculations) |
| created_at | TIMESTAMPTZ | Auto-set on creation |
| updated_at | TIMESTAMPTZ | Auto-set on update |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/horses` | List all horses |
| POST | `/api/horses` | Create horse (auto-creates budget sub-items) |
| GET | `/api/horses/[id]` | Get horse by ID |
| PUT | `/api/horses/[id]` | Update horse |
| DELETE | `/api/horses/[id]` | Delete horse |

### Queries

| Function | File | Description |
|---|---|---|
| `getHorses()` | `lib/queries/horses.ts` | List all horses |
| `getHorse(id)` | `lib/queries/horses.ts` | Get single horse |
| `createHorse(data)` | `lib/queries/horses.ts` | Insert horse + auto-create budget sub-items for per-horse categories |
| `updateHorse(id, data)` | `lib/queries/horses.ts` | Update horse name/weight |
| `deleteHorse(id)` | `lib/queries/horses.ts` | Delete horse |

### Pages

**`/horses/[id]`** -- Horse detail/edit page:
- Edit horse name and weight
- Save changes via API

**`/settings?tab=barn`** -- Barn settings tab:
- List all horses with edit/delete
- Add new horse form
- Auto-creates budget sub-items on horse creation

### Key Behaviors

- **Auto budget sub-items** -- When a horse is created via `createHorse()`, sub-items are automatically inserted under budget categories flagged as `is_system` and per-horse (Board, Farrier, Vet, Supplements). This ensures new horses immediately have budget line items without manual setup.
- **Weight for ride calculations** -- Horse weight from `horses.weight_lbs` is used by `calculateHorseMcal()` in `lib/queries/rides.ts` to estimate metabolic expenditure during ride sessions.

---

## Feature 2: Calendar & Events

### Summary

Calendar & Events provides a month-view calendar showing horse shows, vet visits, farrier appointments, lessons, pony club events, rides, and other activities. Events support optional start/end times, location, entry due dates, notes, and event-type-specific checklists generated from templates. The digest page shows events requiring confirmation (from email ingestion) and the weather page shows ride-day forecasts.

### Goals

- Display all barn events on a month-view calendar with type-coded badges
- Support 7 event types: show, vet, farrier, lesson, pony_club, ride, other
- Attach checklists to events via templates (e.g., show prep checklist)
- Track confirmation status for events created via email ingestion
- Provide entry due date tracking for show entries

### Out of Scope

- Recurring events (events are single-occurrence only)
- Multi-day event display spanning calendar cells
- Attendee tracking or RSVP management

### Future Scope

- **Recurring events** -- Add recurrence rules (weekly, monthly) for regular lessons or farrier visits, similar to treatment schedules
- **Event attachments** -- Allow file uploads (entry forms, show programs) attached to events
- **Multi-day rendering** -- Visually span events across calendar cells when start_date != end_date

### Data Model

**events**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| title | TEXT | Event name (required) |
| event_type | TEXT | One of: show, vet, farrier, lesson, pony_club, ride, other |
| start_date | DATE | Event start date (required) |
| end_date | DATE (nullable) | Event end date (for multi-day events) |
| start_time | TIME (nullable) | Event start time |
| end_time | TIME (nullable) | Event end time |
| location | TEXT (nullable) | Venue or address |
| entry_due_date | DATE (nullable) | Deadline for show entries |
| notes | TEXT (nullable) | Free-text notes |
| checklist_template_id | INTEGER (nullable) | FK to checklist_templates; used on creation to instantiate items |
| reminder_uid | TEXT (nullable) | CalDAV VTODO UID for reminder sync |
| is_confirmed | BOOLEAN | Whether event is confirmed (default true; false for email-ingested) |
| created_by | TEXT (nullable) | Source identifier (e.g., "email", "icloud") |
| created_at | TIMESTAMPTZ | Auto-set on creation |
| updated_at | TIMESTAMPTZ | Auto-set on update |

**event_checklists**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| event_id | INTEGER | FK to events (CASCADE on delete) |
| title | TEXT | Checklist item text |
| due_date | DATE (nullable) | When this item is due |
| is_completed | BOOLEAN | Completion status |
| reminder_uid | TEXT (nullable) | CalDAV VTODO UID for individual item reminder |
| sort_order | INTEGER | Display ordering |

**checklist_templates**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Template name |
| event_type | TEXT | Event type this template applies to |

**checklist_template_items**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| template_id | INTEGER | FK to checklist_templates |
| title | TEXT | Item title |
| days_before_event | INTEGER | Days before event this item is due |
| sort_order | INTEGER | Display ordering |

**checklist_template_reminders**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| template_id | INTEGER | FK to checklist_templates |
| days_before | INTEGER | Days before event to create reminder |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/events` | List events (supports `?month=YYYY-MM` filter) |
| POST | `/api/events` | Create event (optionally instantiates checklist from template) |
| GET | `/api/events/[id]` | Get event with checklists |
| PUT | `/api/events/[id]` | Update event |
| DELETE | `/api/events/[id]` | Delete event (cascades checklists) |
| GET | `/api/events/[id]/checklist` | List checklist items |
| POST | `/api/events/[id]/checklist` | Add checklist item |
| PUT | `/api/events/[id]/checklist/[itemId]` | Update checklist item (toggle complete, edit title) |
| DELETE | `/api/events/[id]/checklist/[itemId]` | Delete checklist item |

### Pages

**`/calendar`** -- Month calendar view:
- Grid layout with day cells showing events as colored badges
- Event type badges with distinct colors per type
- Click event to navigate to detail page
- Month navigation with MonthSelector

**`/calendar/event`** -- Create new event:
- Form with type selector, dates, times, location, notes
- Template selector for checklist auto-generation
- Entry due date field (for shows)

**`/calendar/event/[id]`** -- Event detail/edit page:
- Edit all event fields
- Checklist view with add/remove/toggle items
- Delete event button

**`/calendar/digest`** -- Event digest/confirmation page:
- Lists events pending confirmation (from email ingestion)
- Confirm or dismiss buttons per event
- Suggested ride windows from weather scoring
- `formatTime12h()` helper for time display

### Key Behaviors

- **Template instantiation** -- When creating an event with a `checklist_template_id`, all template items are copied into `event_checklists` with `due_date` calculated as `event.start_date - days_before_event`. This is a one-time copy; changing the template later does not affect existing events.
- **Event type badges** -- `EventCard.tsx` renders colored badges per event type. The mapping is defined in both `EventCard.tsx` and `digest/page.tsx` -- when adding new event types, both must be updated.
- **Time formatting** -- `formatTime12h()` is duplicated in `EventCard.tsx`, `digest/page.tsx`, and `weather/page.tsx`. Changes must be applied to all three copies.
- **Date handling** -- PostgreSQL DATE values serialize as `"2026-02-21T00:00:00.000Z"`. For client display, split on `"T"` and construct with noon (`T12:00:00`) to prevent timezone-related day shifts in US timezones.
- **Confirmation flow** -- Events created via email ingestion start with `is_confirmed = false`. The digest page shows unconfirmed events with confirm/dismiss actions. Confirming sets `is_confirmed = true`; dismissing deletes the event.

---

## Feature 3: Ride Tracking

### Summary

Ride Tracking logs individual ride sessions with gait breakdowns (walk, trot, canter minutes), total duration, distance, and computed fitness metrics. Rider calorie burn is calculated from session duration and rider weight; horse MCal expenditure is calculated from duration and horse weight. The stats page shows aggregated trends by week, month, and year with gait distribution charts.

### Goals

- Log ride sessions with date, horse, duration, and gait breakdown
- Calculate rider calories burned and horse metabolic cost
- Provide statistics aggregated by time period
- Track distance (miles) per ride
- Support rides from multiple sources (manual entry, email)

### Out of Scope

- GPS tracking or route mapping
- Real-time ride timer
- Multi-rider sessions (one rider per session)

### Future Scope

- **Ride goals** -- Set weekly/monthly ride count or duration targets with progress tracking
- **Ride streaks** -- Track consecutive days/weeks with rides for motivation
- **Gait quality notes** -- Add per-gait notes (e.g., "trot felt uneven") beyond the free-text notes field

### Data Model

**ride_sessions**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| rider_id | INTEGER | FK to users |
| horse_id | INTEGER (nullable) | FK to horses |
| date | DATE | Ride date |
| total_duration_minutes | INTEGER | Total ride time |
| walk_minutes | INTEGER | Time at walk |
| trot_minutes | INTEGER | Time at trot |
| canter_minutes | INTEGER | Time at canter |
| distance_miles | NUMERIC (nullable) | Distance covered |
| rider_calories_burned | INTEGER (nullable) | Computed from duration + rider weight |
| horse_mcal_expended | NUMERIC (nullable) | Computed from duration + horse weight |
| notes | TEXT (nullable) | Free-text ride notes |
| source | TEXT | Entry source: "manual" or "email" |
| created_at | TIMESTAMPTZ | Auto-set on creation |
| updated_at | TIMESTAMPTZ | Auto-set on update |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/rides` | List rides (supports month/date filters) |
| POST | `/api/rides` | Create ride session |
| GET | `/api/rides/[id]` | Get ride by ID |
| PUT | `/api/rides/[id]` | Update ride |
| DELETE | `/api/rides/[id]` | Delete ride |
| GET | `/api/rides/stats` | Aggregated stats (period-based: week/month/year) |

### Queries

| Function | File | Description |
|---|---|---|
| `getRides(filters)` | `lib/queries/rides.ts` | List rides with optional date/month filters |
| `createRide(data)` | `lib/queries/rides.ts` | Insert ride, compute calories/MCal |
| `updateRide(id, data)` | `lib/queries/rides.ts` | Update ride, recompute fitness metrics |
| `deleteRide(id)` | `lib/queries/rides.ts` | Delete ride |
| `getRideStats(period)` | `lib/queries/rides.ts` | Aggregated stats by time period |
| `calculateRiderCalories(minutes, weightLbs)` | `lib/queries/rides.ts` | Calorie estimation formula |
| `calculateHorseMcal(minutes, weightLbs)` | `lib/queries/rides.ts` | MCal expenditure formula |

### Pages

**`/rides`** -- Ride session log:
- Chronological list of rides with RideCard components
- Gait breakdown visualization (walk/trot/canter bars)
- Filter by month

**`/rides/entry`** -- Create/edit ride:
- Horse selector, date picker, duration inputs
- Gait minute sliders or text fields
- Distance and notes fields
- Auto-calculates calories/MCal on save

**`/rides/stats`** -- Ride statistics:
- Period selector (week/month/year)
- Total rides, total minutes, total distance
- Gait distribution breakdown with GaitBreakdown component
- Trend charts

### Key Behaviors

- **Calorie calculation** -- `calculateRiderCalories()` uses rider weight from `users.weight_lbs` and ride duration to estimate calories burned. Formula accounts for average MET value of horseback riding.
- **MCal calculation** -- `calculateHorseMcal()` uses horse weight from `horses.weight_lbs` and ride duration to estimate metabolic energy expenditure.
- **Gait colors** -- Walk uses `--gait-walk` (green), trot uses `--gait-trot` (amber), canter uses `--gait-canter` (red). These are defined as CSS custom properties in `globals.css`.
- **Source tracking** -- Rides have a `source` field distinguishing manual entry from email-ingested rides, allowing filtering and display logic.

---

## Feature 4: Budget System

### Summary

The Budget System tracks barn expenses against monthly budgets organized by category and sub-item. Categories (Board, Farrier, Vet, Supplements, etc.) have sub-items that can be linked to specific horses. Monthly budget allocations can be set manually or applied from templates. The month-end close process locks the month, calculates net result (income + sales - expenses), and adjusts the horse savings account. Closed months can be reopened if corrections are needed.

### Goals

- Track expenses by category, sub-item, vendor, and date
- Set monthly budgets per category/sub-item and compare against actual spending
- Support budget templates for quick month setup
- Provide month-end close/reopen workflow with savings account management
- Show spending trends and yearly summaries
- Support bulk expense import via CSV paste

### Out of Scope

- Multi-currency support
- Receipt photo capture or OCR
- Automatic bank statement import

### Future Scope

- **Deficit carryover** -- Currently `deficit_carryover` is always 0 and months are independent. Could carry forward negative balances to reduce next month's available budget
- **Budget variance alerts** -- Notify when spending exceeds budget threshold (e.g., 80% or 100%) for a category
- **Expense approval workflow** -- Require approval for expenses over a threshold amount

### Data Model

**budget_categories**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Category name (e.g., "Board", "Farrier") |
| is_system | BOOLEAN | Whether this is a built-in category |
| is_custom | BOOLEAN | Whether this is user-created |
| sort_order | INTEGER | Display ordering |

**budget_category_sub_items**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| category_id | INTEGER | FK to budget_categories |
| label | TEXT | Sub-item label (e.g., horse name) |
| horse_id | INTEGER (nullable) | FK to horses (auto-created when horse added) |
| sort_order | INTEGER | Display ordering |

**monthly_budgets**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| year_month | TEXT | Budget period (format: "YYYY-MM") |
| category_id | INTEGER | FK to budget_categories |
| sub_item_id | INTEGER (nullable) | FK to budget_category_sub_items |
| budgeted_amount | NUMERIC | Allocated budget for this period |

**expenses**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| category_id | INTEGER | FK to budget_categories |
| sub_item_id | INTEGER (nullable) | FK to budget_category_sub_items |
| amount | NUMERIC | Expense amount |
| vendor | TEXT (nullable) | Vendor/payee name |
| date | DATE | Expense date |
| notes | TEXT (nullable) | Free-text notes |
| source | TEXT | Entry source: "manual", "email", "bulk" |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**monthly_balances**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| year_month | TEXT | Month (UNIQUE) |
| total_budgeted | NUMERIC | Sum of all budgets for the month |
| total_spent | NUMERIC | Sum of all expenses for the month |
| total_income_actual | NUMERIC | Actual income received |
| total_sales | NUMERIC | Sum of sales |
| previous_deficit | NUMERIC | Carried forward deficit (always 0 currently) |
| net_result | NUMERIC | income + sales - expenses |
| savings_contribution | NUMERIC | Amount added to savings (max(net, 0)) |
| savings_withdrawal | NUMERIC | Amount withdrawn from savings (max(-net, 0)) |
| deficit_carryover | NUMERIC | Deficit to carry forward (always 0 currently) |
| is_closed | BOOLEAN | Whether month is locked |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**horse_savings_account**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| balance | NUMERIC | Current savings balance (single row) |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**budget_templates**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Template name |
| is_default | BOOLEAN | Whether this is the default template |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**budget_template_items**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| template_id | INTEGER | FK to budget_templates |
| category_id | INTEGER | FK to budget_categories |
| sub_item_id | INTEGER (nullable) | FK to budget_category_sub_items |
| budgeted_amount | NUMERIC | Budget amount for this item |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/budget/overview` | Monthly spending summary by category |
| GET | `/api/budget/balance` | Monthly balance calculation (live or closed) |
| GET | `/api/budget/monthly` | Get budgets for a month |
| POST | `/api/budget/monthly/apply-defaults` | Apply template to month |
| POST | `/api/budget/close-month` | Close/finalize month (locks + adjusts savings) |
| POST | `/api/budget/reopen-month` | Reopen closed month (reverses savings adjustment) |
| GET | `/api/budget/savings` | Get savings account balance |
| GET | `/api/budget/trends` | Expense trends over time |
| GET | `/api/budget/yearly` | Yearly income/expense summary |
| GET/POST | `/api/budget/categories` | List/create categories |
| GET/PUT/DELETE | `/api/budget/categories/[id]` | Manage category |
| POST | `/api/budget/categories/[id]/sub-items` | Create sub-item |
| PUT/DELETE | `/api/budget/categories/[id]/sub-items/[subId]` | Manage sub-item |
| GET/POST | `/api/budget/templates` | List/create templates |
| GET/PUT/DELETE | `/api/budget/templates/[id]` | Manage template |
| POST | `/api/budget/templates/[id]/apply` | Apply template to month |
| POST | `/api/budget/templates/[id]/clone` | Clone template |
| GET/POST | `/api/budget/templates/[id]/items` | Manage template items |
| GET/POST | `/api/expenses` | List/create expenses |
| GET/PUT/DELETE | `/api/expenses/[id]` | Manage expense |
| POST | `/api/expenses/bulk` | Bulk import expenses (CSV paste) |
| GET | `/api/expenses/vendor-spending` | Vendor spending analytics |

### Pages

**`/budget`** -- Budget overview:
- Monthly budget vs. actual spending by category (CategoryCard components)
- Spending pie chart and budget bar chart
- Savings account card
- MonthSelector for navigation

**`/budget/entry`** -- Expense entry form:
- Category/sub-item selectors
- Amount, vendor, date, notes fields
- Tag picker for auto-categorization

**`/budget/expenses`** -- Expense list:
- Searchable/filterable expense table (ExpenseTable component)
- Vendor and category filters
- Edit/delete inline

**`/budget/vendors`** -- Vendor spending analytics:
- Vendor-wise spending breakdown
- Sparkline trends per vendor

**`/budget/income`** -- Income tracking (see Feature 5)

**`/budget/close`** -- Month-end close/reopen:
- Summary: income, sales, spending, net result
- Savings account projection (current -> after close)
- Close Month button with confirmation modal
- Reopen Month button for closed months with confirmation

**`/budget/bulk`** -- Bulk expense import:
- CSV paste area (BulkPasteEntry component)
- Preview and confirm before import

**`/budget/pending`** -- Pending email approvals:
- List of expenses from email ingestion awaiting approval

### Key Behaviors

- **Month independence** -- Months are independent; deficit carryover is always 0. This means reopening month A does not invalidate later closed months, so any closed month can safely be reopened.
- **Close transaction** -- `closeMonth()` runs in a database transaction: calculates net result, inserts/upserts `monthly_balances` with `is_closed = true`, and adjusts `horse_savings_account.balance` by the net result.
- **Reopen transaction** -- `reopenMonth()` reverses the close: subtracts `net_result` from savings, sets `is_closed = false`. The balance API then returns live-calculated values instead of frozen snapshot values.
- **Balance API logic** -- `GET /api/budget/balance` checks `existingBalance?.is_closed`. If the record exists and `is_closed = true`, returns frozen snapshot with `is_live: false`. Otherwise returns live-calculated values with `is_live: true`. This handles both never-closed months and reopened months correctly.
- **Template system** -- Budget templates store reusable budget allocations. `applyTemplate()` copies template items into `monthly_budgets` for the target month. Templates can be cloned and edited.
- **Bulk import** -- CSV paste via `BulkPasteEntry` parses tab-separated or comma-separated rows, maps columns to fields, and creates expenses in bulk via `/api/expenses/bulk`.
- **Vendor auto-categorization** -- When creating an expense, vendor mappings are checked to auto-fill category and sub-item (see Feature 10).

---

## Feature 5: Income & Sales

### Summary

Income & Sales tracks money coming into the barn from regular income sources (e.g., boarding fees, lesson fees) and one-time sales. Income sources are categories with sub-items, supporting both projected and actual amounts per month. Sales are standalone one-time transactions. Both feed into the month-end close calculation alongside expenses.

### Goals

- Track recurring income sources with monthly projections and actuals
- Record one-time sales separately from recurring income
- Feed income and sales into the net result calculation for month-end close

### Out of Scope

- Invoice generation or payment tracking
- Client/boarder management linked to income

### Future Scope

- **Income variance tracking** -- Show projected vs. actual income trends over time
- **Auto-populate projections** -- Copy last month's actual income as next month's projection

### Data Model

**income_categories** (originally `income_sources`, renamed in migration 006)

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Income source name |
| sort_order | INTEGER | Display ordering |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**income_sub_items**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| category_id | INTEGER | FK to income_categories |
| label | TEXT | Sub-item label |
| sort_order | INTEGER | Display ordering |

**monthly_income**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| year_month | TEXT | Month (format: "YYYY-MM") |
| category_id | INTEGER | FK to income_categories |
| sub_item_id | INTEGER (nullable) | FK to income_sub_items |
| projected_amount | NUMERIC | Expected income |
| actual_amount | NUMERIC | Actually received |

**sales**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| description | TEXT | What was sold |
| amount | NUMERIC | Sale amount |
| date | DATE | Sale date |
| created_at | TIMESTAMPTZ | Auto-set on creation |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/income/sources` | List/create income categories |
| GET/PUT/DELETE | `/api/income/sources/[id]` | Manage income category |
| POST | `/api/income/sources/[id]/sub-items` | Create income sub-item |
| PUT/DELETE | `/api/income/sources/[id]/sub-items/[subId]` | Manage sub-item |
| GET | `/api/income/monthly` | Get monthly income (projected + actual) |
| GET/POST | `/api/sales` | List/create sales |
| GET/PUT/DELETE | `/api/sales/[id]` | Manage sale |

### Pages

**`/budget/income`** -- Income tracking page:
- Monthly income table with projected and actual columns per source
- Add/edit inline
- Sales section below with add/edit/delete

### Key Behaviors

- **Net result formula** -- `net_result = total_income_actual + total_sales - total_spent`. This is calculated by `calculateMonthEndBalance()` in `lib/queries/monthly-balance.ts` and used by the close/reopen workflow.
- **Category rename** -- The table is `income_categories` (renamed from `income_sources` in migration 006) but the API routes still use `/api/income/sources` for backward compatibility.

---

## Feature 6: Weather Intelligence

### Summary

Weather Intelligence fetches 8-day forecasts from OpenWeatherMap and scores each day as green (good to ride), yellow (caution), or red (don't ride) based on configurable thresholds for rain, temperature, wind, and footing moisture. The system models footing moisture using a drying-rate algorithm that factors in recent rainfall and drying time. Blanket alerts notify when overnight lows drop below a threshold. The footing feedback loop allows users to report actual footing conditions to auto-tune the drying rate over time.

### Goals

- Provide daily ride readiness scores (green/yellow/red) with reason explanations
- Model footing moisture with rain accumulation and drying curves
- Generate blanket reminders for cold overnight temperatures
- Support indoor arena override (downgrades red weather to yellow)
- Auto-tune drying rate from user footing feedback

### Out of Scope

- Historical weather data storage beyond prediction snapshots
- Weather-based automatic ride scheduling
- Multiple location support

### Future Scope

- **Extended forecast** -- Show 14-day forecasts if OpenWeatherMap API supports it
- **Footing sensor integration** -- Accept data from physical moisture sensors instead of model-based estimates
- **Wind direction consideration** -- Factor prevailing wind direction into arena exposure calculations

### Data Model

**weather_settings**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| location_lat | NUMERIC | Barn latitude |
| location_lng | NUMERIC | Barn longitude |
| rain_cutoff_inches | NUMERIC | Rain threshold for red score |
| rain_window_hours | INTEGER | Hours of rain history to consider |
| cold_alert_temp_f | INTEGER | Cold alert threshold (blanket + ride score) |
| heat_alert_temp_f | INTEGER | Heat alert threshold |
| wind_cutoff_mph | INTEGER | Wind speed red threshold |
| has_indoor_arena | BOOLEAN | Indoor arena available (downgrades weather-red to yellow) |
| footing_caution_inches | NUMERIC | Moisture level for yellow footing |
| footing_danger_inches | NUMERIC | Moisture level for red footing |
| footing_dry_hours_per_inch | NUMERIC | Drying rate (hours per inch of moisture) |
| auto_tune_drying_rate | BOOLEAN | Whether to auto-adjust drying rate from feedback |
| last_tuned_at | TIMESTAMPTZ (nullable) | When drying rate was last auto-tuned |

**weather_prediction_snapshots**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| date | DATE | Forecast date (UNIQUE) |
| score | TEXT | Ride score: "green", "yellow", or "red" |
| reasons | TEXT[] | Array of reason strings |
| predicted_moisture | NUMERIC (nullable) | Estimated footing moisture |
| predicted_hours_to_dry | NUMERIC (nullable) | Estimated hours until dry |
| forecast_high_f | NUMERIC (nullable) | Forecast high temperature |
| forecast_low_f | NUMERIC (nullable) | Forecast low temperature |
| forecast_day_f | NUMERIC (nullable) | Daytime average temperature |
| forecast_precip_chance | NUMERIC (nullable) | Precipitation probability |
| forecast_precip_inches | NUMERIC (nullable) | Expected precipitation |
| forecast_wind_mph | NUMERIC (nullable) | Wind speed |
| forecast_clouds_pct | NUMERIC (nullable) | Cloud cover percentage |
| forecast_condition | TEXT (nullable) | Weather condition label |
| drying_rate_at_time | NUMERIC (nullable) | Drying rate used for this prediction |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**footing_feedback**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| date | DATE | Observation date (UNIQUE) |
| ride_session_id | INTEGER (nullable) | FK to ride_sessions |
| actual_footing | TEXT | User-reported footing condition |
| predicted_score | TEXT (nullable) | What the model predicted |
| predicted_moisture | NUMERIC (nullable) | Model's moisture estimate |
| drying_rate_at_time | NUMERIC (nullable) | Drying rate when prediction was made |
| created_at | TIMESTAMPTZ | Auto-set on creation |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/weather/forecast` | Get current 8-day forecast |
| GET | `/api/weather/alerts` | Get current weather alerts |
| GET | `/api/weather/ride-days` | Calculate and store scored ride days |
| GET/PUT | `/api/weather/settings` | Get/update weather settings |
| GET/POST | `/api/footing-feedback` | List/submit footing observations |
| POST | `/api/footing-feedback/accuracy` | Record prediction accuracy for tuning |

### Pages

**`/calendar/weather`** -- Weather forecast page:
- 8-day forecast grid with color-coded ride scores
- Per-day detail: temperature, precipitation, wind, footing moisture
- Reason explanations for yellow/red scores
- Blanket alert indicators
- `formatTime12h()` helper (duplicated -- see Feature 2)

### Key Behaviors

- **Scoring pipeline** -- `scoreDays()` in `lib/weather-rules.ts` evaluates each day against settings thresholds. Score starts at green and can only escalate (green -> yellow -> red, never downgrade). Multiple factors can accumulate reasons.
- **Rain scoring** -- Checks `precipitation_inches` against `rain_cutoff_inches`. Uses 48-hour lookback window with hourly granularity for days 0-1, daily aggregates for days 2+.
- **Temperature scoring** -- Uses `day_f` (daytime temperature) for ride scoring. Below `cold_alert_temp_f` is red; within 10F is yellow. Above `heat_alert_temp_f` is red; within 10F below is yellow.
- **Blanket check** -- Separate from ride score. Uses hourly data for overnight window (8pm-9am). If overnight low drops below `cold_alert_temp_f`, a blanket note is added. For days 2+ without hourly data, falls back to `low_f`.
- **Footing moisture model** -- `estimateMoisture()` accumulates rainfall and applies a drying rate (`footing_dry_hours_per_inch`). Above `footing_caution_inches` triggers yellow; above `footing_danger_inches` triggers red.
- **Indoor arena override** -- If `has_indoor_arena` is true and the only reason for red is weather (not footing), the score is downgraded to yellow with a note.
- **Auto-tune** -- When `auto_tune_drying_rate` is true and sufficient footing feedback exists, the system adjusts `footing_dry_hours_per_inch` based on actual vs. predicted moisture levels.
- **Settings refresh** -- Weather API routes read settings from DB on each request. No caching layer exists, so changes to settings take effect on the next API call.
- **Timezone handling** -- OpenWeatherMap timestamps are UTC. `getLocalHour(isoTimestamp, tzOffsetSec)` from `lib/openweathermap.ts` converts to local time. Never use raw `new Date(iso).getHours()`.

---

## Feature 7: CalDAV Sync

### Summary

CalDAV Sync provides two-way calendar synchronization with iCloud Calendar or a self-hosted Radicale server. Events can be read from CalDAV calendars and imported into Barnbook, and reminders are written back as VTODO items. The system supports multiple separate Reminders lists for checklists, weather alerts, and treatment reminders.

### Goals

- Read events from iCloud or Radicale calendars
- Write reminders (VTODO) to CalDAV for checklists, weather, and treatments
- Support both iCloud and self-hosted Radicale as CalDAV backends
- Deduplicate synced events via UID tracking

### Out of Scope

- Two-way event editing (events imported from CalDAV are read-only in Barnbook)
- Conflict resolution for concurrent edits
- Google Calendar support (CalDAV-only)

### Future Scope

- **Push events to CalDAV** -- Currently events flow CalDAV -> Barnbook for reading; could write Barnbook-created events back to CalDAV calendars
- **Selective sync** -- Choose which event types to sync from CalDAV

### Data Model

**icloud_settings**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| read_calendar_ids | TEXT[] | CalDAV calendar IDs to read events from |
| write_calendar_id | TEXT (nullable) | Calendar ID for writing events |
| write_reminders_calendar_id | TEXT (nullable) | Default reminders list (deprecated) |
| reminders_checklists_id | TEXT (nullable) | Reminders list for event checklists |
| reminders_weather_id | TEXT (nullable) | Reminders list for weather/blanket alerts |
| reminders_treatments_id | TEXT (nullable) | Reminders list for treatment reminders |
| use_radicale | BOOLEAN | Whether to use Radicale instead of iCloud |
| radicale_calendar_collection | TEXT (nullable) | Radicale calendar collection path |
| radicale_checklists_collection | TEXT (nullable) | Radicale checklists reminders collection |
| radicale_weather_collection | TEXT (nullable) | Radicale weather reminders collection |
| radicale_treatments_collection | TEXT (nullable) | Radicale treatments reminders collection |

**icloud_sync_state**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| ical_uid | TEXT | CalDAV event UID (UNIQUE) |
| event_id | INTEGER | FK to events |
| calendar_id | TEXT | Source calendar ID |
| last_seen_at | TIMESTAMPTZ | Last sync timestamp |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/sync/status` | Get sync configuration status |
| POST | `/api/sync/icloud` | Trigger event sync from CalDAV |
| GET | `/api/sync/icloud/calendars` | List available CalDAV calendars |
| GET/PUT | `/api/sync/icloud/settings` | Get/update sync settings |
| GET | `/api/sync/radicale/collections` | List Radicale collections |
| POST | `/api/sync/reminders` | Push reminders to CalDAV |
| GET | `/api/sync/reminders/pull` | Pull reminder completion status from CalDAV |

### Key Behaviors

- **Dual backend** -- `lib/caldav.ts` supports both iCloud and Radicale. When `icloud_settings.use_radicale` is true, Radicale credentials and collection paths are used instead of iCloud.
- **Three reminders lists** -- Reminders are split into three CalDAV lists: checklists (event prep items), weather (blanket alerts), and treatments (deworming, farrier, etc.). Each has its own collection ID in settings.
- **UID deduplication** -- `icloud_sync_state` tracks which CalDAV UIDs have been imported. On sync, existing UIDs are skipped to prevent duplicates.
- **Noon UTC normalization** -- `toNoonUTC()` converts dates to noon UTC to prevent timezone-related day shifts. Used for all CalDAV date operations.
- **Radicale htpasswd** -- When Radicale is configured, htpasswd files are generated in Python for robustness.

---

## Feature 8: Reminders

### Summary

Reminders manages three types of recurring alerts written as VTODO items to CalDAV (iCloud or Radicale): treatment reminders (deworming, farrier, supplements), blanket reminders (overnight cold alerts), and event checklist reminders (show prep items). Each reminder stores a `reminder_uid` linking it to the CalDAV VTODO for sync and deletion.

### Goals

- Generate treatment reminders on a recurring schedule (every N days)
- Generate blanket reminders when overnight lows drop below threshold
- Link event checklist items to CalDAV reminders
- Support create/delete sync with CalDAV backend

### Out of Scope

- Reminder snoozing or completion tracking within Barnbook (completion is tracked in CalDAV/Reminders app)
- Push notifications (reminders appear in Apple Reminders or Radicale client)

### Future Scope

- **Custom reminder types** -- Allow user-defined reminder categories beyond treatments, blankets, and checklists
- **Reminder completion pull** -- Pull VTODO completion status from CalDAV back into Barnbook to show what's been done

### Data Model

**treatment_schedules**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Treatment name (e.g., "Deworming") |
| horse_id | INTEGER | FK to horses |
| frequency_days | INTEGER | Days between occurrences |
| start_date | DATE | First occurrence |
| end_date | DATE (nullable) | End date for finite schedules |
| occurrence_count | INTEGER (nullable) | Total occurrences (alternative to end_date) |
| notes | TEXT (nullable) | Treatment notes |
| is_active | BOOLEAN | Whether schedule is active |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**treatment_reminders**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| schedule_id | INTEGER | FK to treatment_schedules |
| due_date | DATE | When this reminder is due |
| reminder_uid | TEXT (nullable) | CalDAV VTODO UID |
| created_at | TIMESTAMPTZ | Auto-set on creation |

UNIQUE constraint on (schedule_id, due_date).

**blanket_reminders**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| date | DATE | Alert date (UNIQUE) |
| overnight_low_f | NUMERIC | Overnight low temperature |
| reminder_uid | TEXT (nullable) | CalDAV VTODO UID |
| created_at | TIMESTAMPTZ | Auto-set on creation |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/treatments` | List/create treatment schedules |
| GET/PUT/DELETE | `/api/treatments/[id]` | Manage treatment schedule |
| POST | `/api/sync/reminders` | Push all pending reminders to CalDAV |
| GET | `/api/sync/reminders/pull` | Pull completion status from CalDAV |

### Key Behaviors

- **Reminder generation** -- `generateReminders()` in `lib/queries/treatment-schedules.ts` walks forward from `start_date` by `frequency_days`, creating `treatment_reminders` rows up to 90 days ahead (or until `end_date`/`occurrence_count`).
- **CalDAV write** -- `writeReminder()` in `lib/caldav.ts` creates a VTODO with the reminder text and due date. The returned UID is stored in `reminder_uid` for later deletion.
- **Blanket reminder creation** -- When weather scoring finds an overnight low below `cold_alert_temp_f`, a `blanket_reminders` row is created and synced to the weather reminders CalDAV list.
- **Checklist reminders** -- Event checklist items (`event_checklists.reminder_uid`) link to individual VTODO items in the checklists CalDAV list.
- **UID tracking** -- All three reminder types store `reminder_uid`. When a reminder is deleted from Barnbook, the corresponding CalDAV VTODO is also deleted via `deleteReminder()`.

---

## Feature 9: Email Ingestion & Calendar Intel

### Summary

Email Ingestion accepts inbound emails, extracts event and expense data using keyword detection, and queues them for user approval. Calendar Intel provides a digest view of pending confirmations alongside AI-suggested ride windows. Detection keywords map text patterns to event types for automatic categorization.

### Goals

- Parse inbound emails for event details (dates, times, locations)
- Use keyword detection to auto-categorize event types
- Queue events and expenses from email for manual approval
- Suggest ride windows based on weather and schedule data

### Out of Scope

- Natural language understanding beyond keyword matching
- Automatic approval without user review
- Email reply/response capabilities

### Future Scope

- **NLP event extraction** -- Replace keyword matching with NLP model for more accurate event parsing
- **Recurring pattern detection** -- Detect recurring events from email series (e.g., weekly lesson confirmations)

### Data Model

**detection_keywords**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| keyword | TEXT | Detection keyword or phrase |
| suggested_event_type | TEXT | Event type to suggest when keyword matches |

**suggested_ride_windows**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| date | DATE | Window date |
| start_time | TIME | Window start |
| end_time | TIME | Window end |
| weather_score | TEXT | green/yellow/red |
| weather_notes | TEXT[] | Reason strings |
| avg_temp_f | NUMERIC (nullable) | Average temperature during window |
| ical_uid | TEXT (nullable) | CalDAV UID if published to calendar |

UNIQUE constraint on (date, start_time).

### API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/email/ingest` | Ingest email payload |
| GET | `/api/email/pending` | List pending email approvals |
| POST | `/api/email/pending/[id]/approve` | Approve email-created event/expense |
| POST | `/api/calendar-intel/digest` | Get digest of pending items |
| POST | `/api/calendar-intel/confirm/[eventId]` | Confirm event |
| POST | `/api/calendar-intel/dismiss/[eventId]` | Dismiss event suggestion |
| GET/POST | `/api/calendar-intel/keywords` | List/create detection keywords |
| GET/PUT/DELETE | `/api/calendar-intel/keywords/[id]` | Manage keyword |
| GET | `/api/calendar-intel/ride-window/[windowId]` | Get ride window details |

### Pages

**`/calendar/digest`** -- Digest/confirmation page:
- Unconfirmed events listed with confirm/dismiss actions
- Suggested ride windows from weather scoring
- Detection keyword hit information

**`/budget/pending`** -- Pending expense approvals:
- Expenses from email ingestion awaiting approval
- Approve to create expense, or dismiss

### Key Behaviors

- **Keyword matching** -- Detection keywords from `detection_keywords` table are matched against inbound email subject/body. Matches suggest an event type for the created event.
- **Confirmation flow** -- Email-ingested events are created with `is_confirmed = false` and `created_by = "email"`. The digest page shows them for manual review.
- **Ride windows** -- `suggested_ride_windows` are generated by crossing weather scores with ride schedule slots. Windows with green/yellow scores during scheduled ride times are surfaced in the digest.
- **Approval pipeline** -- Both events and expenses go through an approval step. Events on the digest page, expenses on the pending page.

---

## Feature 10: Vendors & Tags

### Summary

Vendors & Tags provides two systems for organizing and auto-categorizing expenses. Vendor mappings match vendor name patterns to budget categories, auto-filling category/sub-item when creating expenses. Tags are universal labels (label or vendor type) that can be attached to any entity and optionally carry default categorization.

### Goals

- Auto-categorize expenses by vendor name pattern matching
- Provide universal tagging for cross-entity organization
- Support tags with default budget categorization for quick expense entry

### Out of Scope

- Tag hierarchy or nesting
- Vendor contact information or accounts payable

### Future Scope

- **Tag analytics** -- Show spending breakdown by tag across categories
- **Smart vendor matching** -- Use fuzzy matching or ML for vendor pattern detection instead of exact substring

### Data Model

**vendor_mappings**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| vendor_pattern | TEXT | Pattern to match against vendor name |
| category_id | INTEGER | FK to budget_categories |
| sub_item_id | INTEGER (nullable) | FK to budget_category_sub_items |

**tags**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| name | TEXT | Tag name |
| tag_type | TEXT | Tag type: "label" or "vendor" |
| color | TEXT (nullable) | Display color |
| default_category_id | INTEGER (nullable) | Default budget category for auto-categorization |
| default_sub_item_id | INTEGER (nullable) | Default budget sub-item |

UNIQUE constraint on (name, tag_type).

**entity_tags**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| tag_id | INTEGER | FK to tags |
| entity_type | TEXT | Type of entity (e.g., "expense", "event") |
| entity_id | INTEGER | ID of the tagged entity |

UNIQUE constraint on (tag_id, entity_type, entity_id).

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/tags` | List/create tags |
| GET/PUT/DELETE | `/api/tags/[id]` | Manage tag |
| POST | `/api/tags/match` | Match entity to tags |
| GET/POST | `/api/vendors` | List/create vendor mappings |
| GET/PUT/DELETE | `/api/vendors/[id]` | Manage vendor mapping |
| POST | `/api/vendors/match` | Match vendor string to mappings |

### Key Behaviors

- **Vendor pattern matching** -- When creating an expense, the vendor name is matched against `vendor_mappings.vendor_pattern`. The first match auto-fills `category_id` and `sub_item_id`.
- **Entity-agnostic tags** -- Tags are linked to entities via `entity_tags` with `entity_type` discriminator. This allows tagging expenses, events, or any future entity type without schema changes.
- **Tag default categorization** -- Tags with `default_category_id` set can auto-categorize expenses when the tag is applied, similar to vendor mappings but tag-triggered.

---

## Feature 11: Authentication

### Summary

Authentication uses NextAuth with a credentials provider (email/password) and JWT session strategy. The system supports a single-barn setup with user registration and login. There is no role-based access control -- all authenticated users have full access.

### Goals

- Secure user authentication via email/password
- JWT-based session management
- User registration with profile creation

### Out of Scope

- OAuth providers (Google, Apple, etc.)
- Role-based access control or permissions
- Multi-factor authentication
- Password reset flow

### Future Scope

- **Invite system** -- Allow existing users to invite new users via email link
- **API keys** -- Generate API keys for external integrations without session auth

### Data Model

**users**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| email | TEXT | User email (UNIQUE) |
| password_hash | TEXT | bcrypt hashed password |
| name | TEXT (nullable) | Display name |
| weight_lbs | NUMERIC (nullable) | Rider weight (for calorie calculations) |
| created_at | TIMESTAMPTZ | Auto-set on creation |
| updated_at | TIMESTAMPTZ | Auto-set on update |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| * | `/api/auth/[...nextauth]` | NextAuth handler (login/logout/session) |
| POST | `/api/auth/register` | Create new user account |
| GET | `/api/auth/profile` | Get current user profile |

### Pages

**`/auth/login`** -- Login page:
- Email and password fields
- Submit to NextAuth credentials provider

**`/auth/register`** -- Registration page:
- Email, password, name fields
- Creates user and redirects to login

### Key Behaviors

- **JWT strategy** -- Sessions use JWT tokens, not database sessions. Token contains user ID and email.
- **Session callbacks** -- `lib/auth.ts` configures `jwt` and `session` callbacks to include user ID in the session object.
- **API route protection** -- All API routes check `getServerSession(authOptions)` and return 401 if no session.

---

## Feature 12: Settings

### Summary

Settings is a consolidated page with four tabs: Account (user profile), Barn (horses, checklist templates, detection keywords), Budget (categories, sub-items, income sources, vendors, tags, budget templates), and System (iCloud/Radicale integration, weather configuration, footing feedback). Each tab renders a section component that manages its own state and API calls.

### Goals

- Provide a single settings page with organized tabs
- Allow configuration of all system-wide preferences
- Manage CRUD for horses, categories, templates, vendors, tags, and integrations

### Out of Scope

- Import/export of settings
- Settings backup or versioning
- Per-user settings (single-barn setup)

### Future Scope

- **Settings export/import** -- Export all settings as JSON for backup or migration to another instance
- **Settings changelog** -- Track who changed what setting and when

### Pages

**`/settings`** -- Consolidated settings page with tabs:

**Account Tab:**
- ProfileSection: User name and weight editing

**Barn Tab:**
- HorsesSection: Horse CRUD (add, edit, delete)
- TemplatesSection: Checklist template management
- KeywordsSection: Detection keyword management

**Budget Tab:**
- CategoriesSection: Budget category and sub-item management
- IncomeSourceManager / IncomeCategoryManager: Income source and sub-item management
- VendorsSection: Vendor mapping configuration
- TagsSection: Tag creation and management
- BudgetDefaultsSection: Budget template management

**System Tab:**
- IntegrationsSection: iCloud/Radicale CalDAV configuration
- WeatherSection: Weather location, thresholds, and footing settings
- Footing feedback accuracy review

### Key Behaviors

- **Tab routing** -- The active tab is controlled via `?tab=` query parameter (account, barn, budget, system). Sidebar has a single "Settings" link; MobileMoreSheet has shortcut links per tab.
- **Section components** -- Each section in `components/settings/` is self-contained: manages its own loading state, API calls, and error handling. The parent page simply renders the active tab's sections.
- **Weather settings cascade** -- After saving weather settings, the UI triggers a call to `/api/weather/ride-days` to recalculate all ride scores with the new thresholds.
- **Integration setup** -- IntegrationsSection handles both iCloud and Radicale configuration. When Radicale is selected, it shows collection selectors. When iCloud is selected, it shows calendar selectors. A "Create Lists" button appears when Radicale has no collections configured.

---

## Ride Schedule

### Summary

The Ride Schedule manages recurring weekly ride time slots used by the weather system to calculate suggested ride windows. Each slot defines a day of week with start and end times. The schedule system crosses these slots with weather forecasts to surface optimal riding times.

### Data Model

**ride_schedule**

| Field | Type | Description |
|---|---|---|
| id | SERIAL | Primary key |
| day_of_week | INTEGER | Day of week (0=Sunday, 6=Saturday) |
| start_time | TIME | Slot start time |
| end_time | TIME | Slot end time |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/schedule` | List/create ride schedule slots |
| GET/PUT/DELETE | `/api/schedule/[id]` | Manage slot |
| GET | `/api/schedule/windows` | Get available ride windows for date range |

### Key Behaviors

- **Window calculation** -- `getAvailableWindows()` in `lib/queries/ride-schedule.ts` crosses schedule slots with weather scores and existing events to find open ride windows.
- **Weather integration** -- Suggested ride windows appear in the digest page and use weather scores to color-code viability.
