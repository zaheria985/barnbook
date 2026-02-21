# Settings Hub Consolidation

## Goal
Replace 10 separate settings pages with a single `/settings` page using a tabbed + accordion layout.

## Tab Structure

| Tab | Sections |
|-----|----------|
| Account | Profile |
| Barn | Horses, Weather & Ride Schedule, Calendar Keywords |
| Budget | Categories, Budget Defaults, Vendors, Tags |
| System | Checklist Templates, Integrations |

## Layout
- Top: horizontal tab bar (Account / Barn / Budget / System)
- Body: collapsible accordion sections, one open at a time
- URL tracks tab via `?tab=barn` etc. for shareability
- First section auto-expands on tab switch

## Migration
- Delete all 10 individual `/settings/*` page files
- Extract each page's UI into a standalone component under `components/settings/`
- Single new `app/settings/page.tsx` composes tabs + accordion
- Sidebar: collapse settings section to single "Settings" link

## Components
- `SettingsTabs` — tab bar with URL sync
- `SettingsAccordion` — collapsible section container
- Section components: `ProfileSection`, `HorsesSection`, `WeatherSection`, `KeywordsSection`, `CategoriesSection`, `BudgetDefaultsSection`, `VendorsSection`, `TagsSection`, `TemplatesSection`, `IntegrationsSection`
