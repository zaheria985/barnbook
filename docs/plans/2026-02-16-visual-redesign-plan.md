# Barnbook Visual Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete visual redesign of Barnbook with a jewel-toned palette, dark mode, SVG icon system, and codebase cleanup for public presentation.

**Architecture:** CSS-variable-driven theming with `data-theme` attribute on `<html>`. ThemeProvider context for React. All components already use CSS variables — we swap the palette and add a dark mode block. SVG icons replace emojis in a centralized `icons.tsx` file.

**Tech Stack:** Next.js 14, Tailwind CSS, CSS custom properties, React Context (theme), localStorage (persistence)

**Design reference:** See `docs/plans/2026-02-16-visual-redesign-design.md` for full color tables.

---

## Task 1: Codebase Cleanup

Remove internal dev files from git tracking before any visual work.

**Files:**
- Modify: `.gitignore`

**Step 1: Update .gitignore**

Add these lines to `.gitignore` (at the end, before any existing comments):

```
SPEC.md
AGENTS.md
```

**Step 2: Remove from git tracking**

```bash
git rm --cached SPEC.md AGENTS.md 2>/dev/null; true
```

These files stay on disk but are no longer tracked.

**Step 3: Verify .env is not tracked**

```bash
git ls-files .env
```

Expected: empty output (already in .gitignore). If it outputs `.env`, run `git rm --cached .env`.

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore internal dev docs (SPEC.md, AGENTS.md)"
```

---

## Task 2: Theme System Foundation

Create the theme provider, anti-FOUC script, and new CSS variables.

**Files:**
- Create: `components/ThemeProvider.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Step 1: Create ThemeProvider**

Create `components/ThemeProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
}>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("barnbook-theme") as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        const r = e.matches ? "dark" : "light";
        setResolvedTheme(r);
        document.documentElement.setAttribute("data-theme", r);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("barnbook-theme", t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**Step 2: Rewrite globals.css**

Replace the entire contents of `app/globals.css` with the new jewel-toned palette. The full light mode variables are in `:root`, dark mode in `[data-theme="dark"]`. Refer to the design doc for exact hex values.

Key changes from current:
- `--app-bg`: `#faf8f5` → `#f8f7fa` (warm beige → cool lavender)
- `--interactive`/`--brand`: `#2d6a4f` (green) → `#6d5acd` (amethyst)
- All text colors shift from warm browns to cool indigo-grays
- Add new tokens: `--accent-rose`, `--accent-teal`, `--accent-blue`, `--accent-emerald`, `--accent-amber`
- Add `--gait-walk`, `--gait-trot`, `--gait-canter` tokens for ride gait colors
- Add full `[data-theme="dark"]` block with all variables

Also add Tailwind `@layer base` color-scheme switch:
```css
:root { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
```

**Step 3: Update layout.tsx**

In `app/layout.tsx`:
1. Import `ThemeProvider` from `@/components/ThemeProvider`
2. Add an inline `<script>` in `<head>` to prevent FOUC (sets `data-theme` before paint)
3. Wrap `<Providers>` content with `<ThemeProvider>`

The anti-FOUC script reads `localStorage` and `prefers-color-scheme` synchronously before React hydrates:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var t=localStorage.getItem("barnbook-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`,
  }}
/>
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: clean build, no errors.

**Step 5: Commit**

```bash
git add components/ThemeProvider.tsx app/globals.css app/layout.tsx
git commit -m "feat: add theme system with jewel-toned palette and dark mode"
```

---

## Task 3: SVG Icon System

Create a centralized icon component file replacing all emojis.

**Files:**
- Create: `components/icons.tsx`

**Step 1: Create icons.tsx**

Create `components/icons.tsx` with all needed SVG icon components. Each icon is a function component that accepts `size` (default 20) and `className` props. All use `currentColor`, `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.

Icons to create (all named exports):

**Navigation icons:**
- `IconWallet` — wallet shape (budget)
- `IconChartLine` — line chart (income)
- `IconTable` — grid/table (bulk entry)
- `IconInbox` — inbox tray (pending)
- `IconHorse` — simplified horse head silhouette (rides)
- `IconCalendar` — calendar with grid (calendar)
- `IconSliders` — adjustment sliders (settings/categories)
- `IconClipboard` — clipboard (templates)
- `IconCloudSun` — cloud with sun (weather)
- `IconTag` — tag (keywords)
- `IconStore` — storefront (vendors)
- `IconLink` — chain link (integrations)
- `IconUser` — person silhouette (profile)

**Action icons:**
- `IconPlus` — plus sign
- `IconTrash` — trash can
- `IconEdit` — pencil
- `IconChevronDown` — chevron pointing down
- `IconChevronRight` — chevron pointing right
- `IconChevronLeft` — chevron pointing left
- `IconCheck` — checkmark
- `IconX` — X/close
- `IconSearch` — magnifying glass
- `IconSun` — sun (theme toggle)
- `IconMoon` — crescent moon (theme toggle)
- `IconMonitor` — monitor (system theme)
- `IconLogOut` — log out arrow
- `IconMenu` — hamburger menu (more)
- `IconAlertTriangle` — warning triangle

All SVG paths should be clean, simple, and recognizable at 20x20. Use standard Lucide-style paths where possible.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add components/icons.tsx
git commit -m "feat: add SVG icon system replacing emoji icons"
```

---

## Task 4: Theme Toggle Component

**Files:**
- Create: `components/ThemeToggle.tsx`

**Step 1: Create ThemeToggle**

Create `components/ThemeToggle.tsx`:

```tsx
"use client";

import { useTheme } from "./ThemeProvider";
import { IconSun, IconMoon, IconMonitor } from "./icons";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: IconSun, label: "Light" },
    { value: "dark" as const, icon: IconMoon, label: "Dark" },
    { value: "system" as const, icon: IconMonitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={`rounded-md p-1.5 transition-colors ${
            theme === opt.value
              ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <opt.icon size={16} />
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ThemeToggle.tsx
git commit -m "feat: add theme toggle component (light/dark/system)"
```

---

## Task 5: Sidebar Redesign

Replace emoji navigation with grouped SVG-icon navigation.

**Files:**
- Modify: `components/Sidebar.tsx`

**Step 1: Rewrite Sidebar.tsx**

Key changes:
1. Import SVG icons from `@/components/icons`
2. Import `ThemeToggle` from `@/components/ThemeToggle`
3. Replace `navItems` emoji array with two groups:
   - **Main** group: Budget (IconWallet), Income (IconChartLine), Bulk Entry (IconTable), Pending (IconInbox), Rides (IconHorse), Calendar (IconCalendar)
   - **Settings** group: Categories (IconSliders), Horses (IconHorse), Templates (IconClipboard), Weather (IconCloudSun), Keywords (IconTag), Vendors (IconStore), Integrations (IconLink), Profile (IconUser)
4. Render group headers as small uppercase labels: `<p className="px-3 mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Main</p>`
5. Active item: add `border-l-3 border-l-[var(--interactive)]` accent bar (or use left pseudo-element)
6. Brand header: Replace `🐴` emoji with `IconHorse` icon component, styled in amethyst
7. Footer: Add `<ThemeToggle />` between user name and sign-out button

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: redesign sidebar with SVG icons, grouped nav, theme toggle"
```

---

## Task 6: Mobile Bottom Tabs + More Sheet

Redesign bottom tabs with SVG icons and frosted glass.

**Files:**
- Create: `components/MobileMoreSheet.tsx`
- Modify: `components/BottomTabs.tsx`

**Step 1: Create MobileMoreSheet**

A slide-up sheet component for the "More" tab on mobile. Contains all settings nav items with SVG icons. Uses a backdrop overlay and slides up from bottom.

**Step 2: Rewrite BottomTabs.tsx**

Key changes:
1. Import SVG icons from `@/components/icons`
2. Import `MobileMoreSheet` and manage its open state
3. Replace emoji tabs with SVG icons
4. Add `backdrop-blur-xl bg-[var(--surface)]/80` for frosted glass effect
5. Change 5th tab from "Settings" (link) to "More" (button that opens sheet)
6. Active tab: amethyst color text + small dot indicator above icon

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add components/MobileMoreSheet.tsx components/BottomTabs.tsx
git commit -m "feat: redesign bottom tabs with SVG icons, frosted glass, more sheet"
```

---

## Task 7: UI Component Upgrades

Upgrade Card, StatCard, Modal, Badge, ProgressBar to use new design tokens.

**Files:**
- Modify: `components/ui/Card.tsx`
- Modify: `components/ui/StatCard.tsx`
- Modify: `components/ui/Modal.tsx`
- Modify: `components/ui/Badge.tsx`
- Modify: `components/ui/ProgressBar.tsx`

**Step 1: Card.tsx**

- Change `rounded-xl` → `rounded-2xl`
- Keep `shadow-sm` (works in both themes since dark mode cards rely on borders)

**Step 2: StatCard.tsx**

- Change `rounded-xl` → `rounded-2xl`
- Replace `text-gray-400` sublabel with `text-[var(--text-muted)]`
- Update color map to use new accent tokens:
  - `primary` → `border-l-[var(--interactive)]`
  - `success` → `border-l-[var(--accent-teal)]`
  - `warning` → `border-l-[var(--accent-amber)]`
- Add new variants: `rose` → `border-l-[var(--accent-rose)]`, `blue` → `border-l-[var(--accent-blue)]`

**Step 3: Modal.tsx**

- Change `rounded-xl` → `rounded-2xl`
- Replace close button `text-gray-400 hover:text-gray-600` with `text-[var(--text-muted)] hover:text-[var(--text-primary)]`
- Replace `✕` text with `IconX` from icons.tsx

**Step 4: Badge.tsx**

- Replace hardcoded `bg-red-100 text-red-700` danger variant with `bg-[var(--error-bg)] text-[var(--error-text)]`

**Step 5: ProgressBar.tsx**

- Replace `bg-red-500` with `bg-[var(--error-text)]` (matches error state)

**Step 6: Verify build**

```bash
npm run build
```

**Step 7: Commit**

```bash
git add components/ui/
git commit -m "feat: upgrade UI components with new design tokens and dark mode"
```

---

## Task 8: Chart Components

Update chart colors to jewel palette.

**Files:**
- Modify: `components/budget/SpendingPieChart.tsx`
- Modify: `components/budget/BudgetBarChart.tsx`

**Step 1: SpendingPieChart.tsx**

Replace the `COLORS` array with jewel-toned colors:
```ts
const COLORS = [
  "#6d5acd", "#c44569", "#2d9e8f", "#4a6fa5", "#2d8659",
  "#c48a2c", "#8b6cc1", "#e06080", "#40c4b0", "#6b92cc",
];
```

Update Tooltip `contentStyle` for theme-awareness:
```ts
contentStyle={{
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border-light)",
  borderRadius: "12px",
  color: "var(--text-primary)",
}}
```

**Step 2: BudgetBarChart.tsx**

- Replace budgeted bar fill `#2d6a4f` → `var(--interactive)` (can't use CSS var in recharts directly — use `#6d5acd`)
- Replace actual bar colors: normal `#52b788` → `#2d9e8f`, over-budget `#991b1b` → `#c44569`
- Update grid stroke, axis tick colors, tooltip styling same as above

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add components/budget/SpendingPieChart.tsx components/budget/BudgetBarChart.tsx
git commit -m "feat: update charts with jewel-toned color palette"
```

---

## Task 9: Budget Components

Update CategoryCard, SavingsCard, DeficitBanner, MonthSelector.

**Files:**
- Modify: `components/budget/CategoryCard.tsx`
- Modify: `components/budget/SavingsCard.tsx`
- Modify: `components/budget/DeficitBanner.tsx`
- Modify: `components/budget/MonthSelector.tsx`

**Step 1: CategoryCard.tsx**

- Change `rounded-xl` → `rounded-2xl`
- Internal progress bar colors are already using CSS vars (good)

**Step 2: SavingsCard.tsx**

- Change `rounded-xl` → `rounded-2xl`

**Step 3: DeficitBanner.tsx**

- Change `rounded-xl` → `rounded-2xl`

**Step 4: MonthSelector.tsx**

- Change `rounded-xl` → `rounded-2xl`

**Step 5: Commit**

```bash
git add components/budget/
git commit -m "feat: update budget components with rounded-2xl styling"
```

---

## Task 10: Ride Components

Update GaitBreakdown and RideCard to use CSS variable gait colors.

**Files:**
- Modify: `components/rides/GaitBreakdown.tsx`
- Modify: `components/rides/RideCard.tsx`

**Step 1: GaitBreakdown.tsx**

Replace hardcoded Tailwind classes with CSS variable colors:
- `bg-emerald-400` → `bg-[var(--gait-walk)]` (defined as `--gait-walk: #2d8659` light / `#40a870` dark in globals.css)
- `bg-amber-400` → `bg-[var(--gait-trot)]` (defined as `--gait-trot: #c48a2c` / `#e0a840`)
- `bg-rose-400` → `bg-[var(--gait-canter)]` (defined as `--gait-canter: #c44569` / `#e06080`)

Same for the legend dots.

**Step 2: RideCard.tsx**

- Change `rounded-xl` → `rounded-2xl`

**Step 3: Commit**

```bash
git add components/rides/
git commit -m "feat: update ride components with CSS variable gait colors"
```

---

## Task 11: Calendar Components

Update EventCard, DayCell, MonthGrid, ChecklistView.

**Files:**
- Modify: `components/calendar/EventCard.tsx`
- Modify: `components/calendar/DayCell.tsx`
- Modify: `components/calendar/MonthGrid.tsx`
- Modify: `components/calendar/ChecklistView.tsx`

**Step 1: EventCard.tsx**

Replace hardcoded Tailwind badge colors with CSS-variable-based classes. Add new CSS variable tokens for event types or use inline styles:

```ts
const EVENT_TYPE_BADGE: Record<string, string> = {
  show: "bg-[var(--interactive-light)] text-[var(--interactive)]",
  vet: "bg-[var(--error-bg)] text-[var(--error-text)]",
  farrier: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  lesson: "bg-[color-mix(in_srgb,var(--accent-blue)_15%,transparent)] text-[var(--accent-blue)]",
  pony_club: "bg-[var(--success-bg)] text-[var(--success-text)]",
  other: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
};
```

If `color-mix` isn't supported in your Tailwind version, use explicit CSS variables instead by adding `--event-lesson-bg` etc. to globals.css.

**Step 2: DayCell.tsx**

Replace hardcoded Tailwind event dot colors and ride score border colors with CSS variables:

```ts
const EVENT_TYPE_COLORS: Record<string, string> = {
  show: "bg-[var(--interactive)]",
  vet: "bg-[var(--accent-rose)]",
  farrier: "bg-[var(--accent-amber)]",
  lesson: "bg-[var(--accent-blue)]",
  pony_club: "bg-[var(--accent-emerald)]",
  other: "bg-[var(--text-muted)]",
};

const RIDE_SCORE_BORDER: Record<string, string> = {
  green: "border-l-2 border-l-[var(--accent-emerald)]",
  yellow: "border-l-2 border-l-[var(--accent-amber)]",
  red: "border-l-2 border-l-[var(--accent-rose)]",
};
```

**Step 3: MonthGrid.tsx and ChecklistView.tsx**

These already use CSS variables — no changes needed unless rounding updates desired.

**Step 4: Commit**

```bash
git add components/calendar/
git commit -m "feat: update calendar components with themed event colors"
```

---

## Task 12: Auth Pages

The login and register pages use hardcoded Tailwind colors and don't match the design system.

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `app/auth/register/page.tsx`

**Step 1: Login page**

Replace all hardcoded Tailwind classes with CSS variables:
- `bg-gray-50` → `bg-[var(--app-bg)]`
- `text-gray-900` → `text-[var(--text-primary)]`
- `text-gray-700` → `text-[var(--text-secondary)]`
- `text-gray-600` → `text-[var(--text-muted)]`
- `border-gray-300` → `border-[var(--input-border)]`
- `focus:border-green-500 focus:ring-green-500` → `focus:border-[var(--input-focus-ring)] focus:ring-[var(--input-focus-ring)]`
- `bg-green-700 hover:bg-green-800` → `bg-[var(--interactive)] hover:bg-[var(--interactive-hover)]`
- `text-green-700` → `text-[var(--interactive)]`
- Success banner: `bg-green-50 text-green-800` → `bg-[var(--success-bg)] text-[var(--success-text)]`
- Error banner: `bg-red-50 text-red-600` → `bg-[var(--error-bg)] text-[var(--error-text)]`
- Input bg: add `bg-[var(--input-bg)]`

Also add `rounded-2xl` to the card wrapper and improve the layout to match the rest of the app.

**Step 2: Register page**

Same treatment — replace all hardcoded colors with CSS variables.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add app/auth/
git commit -m "feat: redesign auth pages with themed CSS variables"
```

---

## Task 13: Page-Level Updates

Update all page files to use `rounded-2xl` on cards and ensure consistent styling.

**Files:**
- Modify: `app/budget/page.tsx` — rounded-2xl on summary bar, year overview button
- Modify: `app/rides/page.tsx` — rounded-2xl on summary bar, empty state
- Modify: `app/rides/entry/page.tsx` — rounded-2xl on form cards
- Modify: `app/rides/stats/page.tsx` — rounded-2xl on stat cards
- Modify: `app/calendar/page.tsx` — rounded-2xl on calendar container
- Modify: `app/calendar/event/page.tsx` — rounded-2xl on form
- Modify: `app/calendar/event/[id]/page.tsx` — rounded-2xl
- Modify: `app/budget/entry/page.tsx` — rounded-2xl
- Modify: `app/budget/income/page.tsx` — rounded-2xl
- Modify: `app/budget/close/page.tsx` — rounded-2xl
- Modify: `app/budget/bulk/page.tsx` — rounded-2xl
- Modify: `app/budget/pending/page.tsx` — rounded-2xl
- Modify: `app/settings/categories/page.tsx` — rounded-2xl
- Modify: `app/settings/horses/page.tsx` — rounded-2xl
- Modify: `app/settings/templates/page.tsx` — rounded-2xl
- Modify: `app/settings/weather/page.tsx` — rounded-2xl
- Modify: `app/settings/keywords/page.tsx` — rounded-2xl
- Modify: `app/settings/vendors/page.tsx` — rounded-2xl
- Modify: `app/settings/integrations/page.tsx` — rounded-2xl
- Modify: `app/settings/profile/page.tsx` — rounded-2xl
- Modify: `app/calendar/weather/page.tsx` — rounded-2xl
- Modify: `app/calendar/digest/page.tsx` — rounded-2xl
- Modify: `components/settings/IncomeSourceManager.tsx` — rounded-2xl
- Modify: `components/budget/BulkEntryTable.tsx` — rounded-2xl
- Modify: `components/budget/YearlySummary.tsx` — rounded-2xl

This is a mechanical find-and-replace: `rounded-xl` → `rounded-2xl` on all card/container elements in page files.

Also replace any remaining hardcoded Tailwind color classes (gray-*, green-*, etc.) found in page files with CSS variable equivalents.

**Step 1: Run the replacements**

For each file, replace `rounded-xl` with `rounded-2xl` on card/container elements. Be careful NOT to change `rounded-xl` on small elements like buttons and inputs — those stay at `rounded-xl` (or change to `rounded-lg` for inputs).

Convention:
- Cards, containers, panels: `rounded-2xl`
- Buttons, pills: `rounded-xl`
- Inputs, selects: `rounded-lg`
- Small badges, tags: `rounded-full`

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add app/ components/
git commit -m "feat: apply rounded-2xl and themed colors across all pages"
```

---

## Task 14: Final Build Verification & Polish

**Step 1: Full lint + build check**

```bash
npm run lint && npm run build
```

Fix any lint errors or build failures.

**Step 2: Visual audit checklist**

Mentally verify these are all handled:
- [ ] No hardcoded Tailwind color classes remain (grep for `text-gray-`, `bg-gray-`, `text-green-`, `bg-green-`, `text-red-`, `bg-red-`, `text-amber-`, `bg-amber-`, `bg-emerald-`, `bg-rose-`, `bg-purple-`, `bg-blue-`)
- [ ] All cards use `rounded-2xl`
- [ ] Login/register pages use CSS variables
- [ ] Charts use jewel palette
- [ ] Gait breakdown uses CSS variable colors
- [ ] Event type badges use CSS variable colors
- [ ] Modal close button uses CSS variable colors
- [ ] Badge danger variant uses CSS variables
- [ ] ProgressBar overspend uses CSS variable color
- [ ] StatCard sublabel uses CSS variable color

**Step 3: Search for remaining hardcoded colors**

```bash
grep -rn "text-gray-\|bg-gray-\|text-green-\|bg-green-\|text-red-\|bg-red-\|bg-emerald-\|bg-amber-\|bg-rose-\|bg-purple-\|bg-blue-" --include="*.tsx" app/ components/
```

Fix any remaining instances.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: replace remaining hardcoded colors with CSS variables"
```

**Step 5: Push**

```bash
git push origin main
```
