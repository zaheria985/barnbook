# Barnbook Visual Redesign & Dark Mode

**Date**: 2026-02-16
**Scope**: Full visual redesign, dark mode, codebase cleanup for public presentation
**Approach**: Jewel-toned palette, SVG icon system, polished components, light/dark themes

---

## 1. Color Palette

### Light Mode (`:root`)

| Token | Hex | Usage |
|-------|-----|-------|
| `--app-bg` | `#f8f7fa` | Page background (cool lavender-white) |
| `--surface` | `#ffffff` | Card/panel surfaces |
| `--surface-muted` | `#f2f0f5` | Secondary surfaces, hover states |
| `--surface-subtle` | `#e9e7f0` | Tertiary surfaces |
| `--text-primary` | `#1e1b2e` | Headings, primary content |
| `--text-secondary` | `#46415a` | Labels, descriptions |
| `--text-tertiary` | `#5f5978` | Supporting text |
| `--text-muted` | `#8b84a0` | Placeholders, disabled |
| `--border` | `#d4d0e0` | Default borders |
| `--border-light` | `#e8e5f0` | Subtle card borders |
| `--interactive` | `#6d5acd` | Primary buttons, links, focus rings |
| `--interactive-hover` | `#5a46b8` | Hover state for interactive |
| `--interactive-light` | `#eeebfa` | Light tint for active sidebar |
| `--brand` | `#6d5acd` | Brand color (amethyst) |
| `--brand-contrast` | `#ffffff` | Text on brand |
| `--accent-rose` | `#c44569` | Budget/expense accents |
| `--accent-teal` | `#2d9e8f` | Income/savings accents |
| `--accent-blue` | `#4a6fa5` | Rides/info accents |
| `--accent-emerald` | `#2d8659` | Calendar/events accents |
| `--accent-amber` | `#c48a2c` | Warning accents |
| `--success-bg` | `#ecfaf5` | Success backgrounds |
| `--success-text` | `#1a7a5c` | Success text |
| `--success-solid` | `#2d9e8f` | Success fills |
| `--warning-bg` | `#fef8eb` | Warning backgrounds |
| `--warning-text` | `#946420` | Warning text |
| `--warning-solid` | `#c48a2c` | Warning fills |
| `--warning-border` | `#f5dea0` | Warning borders |
| `--error-bg` | `#fdf0f2` | Error backgrounds |
| `--error-text` | `#a33050` | Error text |
| `--error-border` | `#f0c0cc` | Error borders |
| `--overlay` | `rgb(30 27 46 / 50%)` | Modal overlay |
| `--sidebar-bg` | `#ffffff` | Sidebar background |
| `--sidebar-text` | `#5f5978` | Sidebar link text |
| `--sidebar-hover` | `#f2f0f5` | Sidebar hover state |
| `--sidebar-active-bg` | `#eeebfa` | Sidebar active item background |
| `--sidebar-active-text` | `#5a46b8` | Sidebar active text |
| `--input-bg` | `#ffffff` | Input backgrounds |
| `--input-border` | `#d4d0e0` | Input borders |
| `--input-text` | `#1e1b2e` | Input text |
| `--input-placeholder` | `#8b84a0` | Placeholder text |
| `--input-focus-ring` | `#6d5acd` | Focus ring color |

### Dark Mode (`[data-theme="dark"]`)

| Token | Hex | Usage |
|-------|-----|-------|
| `--app-bg` | `#141220` | Page background (deep indigo night) |
| `--surface` | `#1e1b2e` | Card surfaces |
| `--surface-muted` | `#262339` | Secondary surfaces |
| `--surface-subtle` | `#302d45` | Tertiary surfaces |
| `--text-primary` | `#e8e6f0` | Primary text |
| `--text-secondary` | `#b0acc2` | Secondary text |
| `--text-tertiary` | `#8a85a0` | Tertiary text |
| `--text-muted` | `#6e698a` | Muted text |
| `--border` | `#3a3652` | Borders |
| `--border-light` | `#2e2b42` | Subtle borders |
| `--interactive` | `#9b8ce8` | Interactive elements |
| `--interactive-hover` | `#b0a4f0` | Hover state |
| `--interactive-light` | `#262050` | Active sidebar tint |
| `--brand` | `#9b8ce8` | Brand on dark |
| `--brand-contrast` | `#141220` | Text on brand |
| `--accent-rose` | `#e06080` | Rose on dark |
| `--accent-teal` | `#40c4b0` | Teal on dark |
| `--accent-blue` | `#6b92cc` | Blue on dark |
| `--accent-emerald` | `#40a870` | Emerald on dark |
| `--accent-amber` | `#e0a840` | Amber on dark |
| `--success-bg` | `#1a2e28` | Success bg dark |
| `--success-text` | `#40c4b0` | Success text dark |
| `--success-solid` | `#40c4b0` | Success fill dark |
| `--warning-bg` | `#2e2518` | Warning bg dark |
| `--warning-text` | `#e0a840` | Warning text dark |
| `--warning-solid` | `#e0a840` | Warning fill dark |
| `--warning-border` | `#5a4820` | Warning border dark |
| `--error-bg` | `#2e1820` | Error bg dark |
| `--error-text` | `#e06080` | Error text dark |
| `--error-border` | `#5a2838` | Error border dark |
| `--overlay` | `rgb(10 8 18 / 70%)` | Overlay dark |
| `--sidebar-bg` | `#1a1828` | Sidebar dark |
| `--sidebar-text` | `#8a85a0` | Sidebar text dark |
| `--sidebar-hover` | `#262339` | Sidebar hover dark |
| `--sidebar-active-bg` | `#262050` | Active item dark |
| `--sidebar-active-text` | `#b0a4f0` | Active text dark |
| `--input-bg` | `#1e1b2e` | Input bg dark |
| `--input-border` | `#3a3652` | Input border dark |
| `--input-text` | `#e8e6f0` | Input text dark |
| `--input-placeholder` | `#6e698a` | Placeholder dark |
| `--input-focus-ring` | `#9b8ce8` | Focus ring dark |

---

## 2. Theme System

- Theme stored in `localStorage` key `barnbook-theme`
- Values: `"light"`, `"dark"`, `"system"` (default)
- `data-theme` attribute on `<html>` element
- Script in `<head>` prevents flash of wrong theme (FOUC)
- `ThemeProvider` component wraps app, provides toggle function
- Toggle button in sidebar footer (sun/moon icon)

---

## 3. SVG Icon System

Replace all emoji icons with monoline SVG icons. Implementation as inline SVG components in a single `components/icons.tsx` file.

Icons needed:
- **Navigation**: wallet (budget), chart-line (income), table (bulk entry), inbox (pending), horse (rides), calendar (calendar), sliders (settings), clipboard (templates), cloud-sun (weather), tag (keywords), store (vendors), link (integrations), user (profile)
- **Actions**: plus, trash, edit, chevron-down, chevron-right, check, x, search, sun, moon, log-out
- **Gait indicators**: Walk, Trot, Canter (small colored indicators)

All icons: 20x20 default, stroke-based, `currentColor`, consistent 1.5px stroke width.

---

## 4. Navigation Redesign

### Sidebar
- Grouped with section headers: "Main" (Budget, Rides, Calendar), "Settings" (rest)
- SVG icons replacing emojis
- Active item: left 3px accent bar + tinted background
- Footer: user name, theme toggle, sign out, version

### Bottom Tabs
- 5 tabs: Budget, Rides, Calendar, Entry, More
- "More" opens a slide-up sheet with all settings items
- `backdrop-blur-xl` frosted glass effect
- Active tab: amethyst accent color, subtle scale

---

## 5. Component Upgrades

### Cards
- `rounded-2xl` corners
- Light: `shadow-sm`, hover `shadow-md` with `transition-shadow`
- Dark: border-only, no shadow

### Stat Cards
- Accent colors: Rose (budget), Teal (income), Blue (rides)
- Larger value text (`text-4xl`)
- Animated number transition on value change (optional stretch)

### Buttons
- Primary: `bg-[var(--interactive)]` rounded-xl, smooth hover
- Secondary: ghost/outline
- All with `transition-all duration-150`

### Inputs
- `min-h-[44px]` on all breakpoints
- `rounded-xl` corners
- Amethyst focus ring

### Charts
- Jewel color palette: `#6d5acd`, `#c44569`, `#2d9e8f`, `#4a6fa5`, `#2d8659`, `#c48a2c`, `#8b6cc1`, `#e06080`, `#40c4b0`, `#6b92cc`
- Theme-aware tooltip styling
- Dark mode: lighter grid lines, white text

### Gait Breakdown
- Walk: Emerald `#2d8659` / dark `#40a870`
- Trot: Amber `#c48a2c` / dark `#e0a840`
- Canter: Rose `#c44569` / dark `#e06080`

---

## 6. Codebase Cleanup

- Add to `.gitignore`: `SPEC.md`, `AGENTS.md`
- Remove from git tracking: `SPEC.md`, `AGENTS.md`, `.env` (if tracked)
- Verify `.beads/` excluded
- Replace `text-gray-400` in StatCard with CSS variable
- Audit for any remaining hardcoded color values

---

## 7. Files Touched

### New Files
- `components/icons.tsx` — SVG icon components
- `components/ThemeProvider.tsx` — theme context + toggle
- `components/ThemeToggle.tsx` — sun/moon toggle button
- `components/MobileMoreSheet.tsx` — slide-up settings sheet for mobile

### Modified Files
- `app/globals.css` — new palette, dark mode vars
- `app/layout.tsx` — add ThemeProvider, anti-FOUC script
- `components/Sidebar.tsx` — grouped nav, SVG icons, theme toggle
- `components/BottomTabs.tsx` — SVG icons, frosted glass, "More" tab
- `components/ui/Card.tsx` — rounded-2xl, theme-aware shadows
- `components/ui/StatCard.tsx` — new accent colors, fix hardcoded gray
- `components/ui/Modal.tsx` — dark mode styling
- `components/ui/Badge.tsx` — dark mode colors
- `components/ui/ProgressBar.tsx` — accent colors
- `components/budget/SpendingPieChart.tsx` — jewel color palette
- `components/budget/BudgetBarChart.tsx` — jewel colors, dark theme
- `components/budget/CategoryCard.tsx` — refined styling
- `components/budget/SavingsCard.tsx` — teal accent
- `components/budget/DeficitBanner.tsx` — rose accent
- `components/budget/MonthSelector.tsx` — styling refresh
- `components/budget/BulkEntryTable.tsx` — dark mode inputs
- `components/rides/RideCard.tsx` — blue accent theme
- `components/rides/GaitBreakdown.tsx` — jewel gait colors
- `components/calendar/EventCard.tsx` — emerald accent
- `components/calendar/MonthGrid.tsx` — dark mode grid
- `components/calendar/DayCell.tsx` — dark mode cells
- `components/settings/IncomeSourceManager.tsx` — styling
- All page files (`app/*/page.tsx`) — minor class updates for new tokens
- `.gitignore` — add SPEC.md, AGENTS.md
