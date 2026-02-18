# Apply Budget Defaults to Month

## Problem
Budget defaults exist but never get applied to months. The auto-copy in `/api/budget/monthly` GET isn't triggered by the dashboard's `/api/budget/overview` call.

## Design
- **Button on dashboard** (`/budget`): "Apply Defaults" button visible when budget defaults exist
- **Empty month**: Apply immediately, refresh
- **Month has budgets**: Modal with Fill Gaps / Overwrite All / Cancel
- **API**: `POST /api/budget/monthly/apply-defaults` with `{ month, mode: "fill" | "overwrite" }`
- **fill mode**: INSERT from defaults ON CONFLICT DO NOTHING
- **overwrite mode**: DELETE all monthly budgets for month, then insert defaults

## Files
| File | Action |
|------|--------|
| `app/api/budget/monthly/apply-defaults/route.ts` | New API endpoint |
| `app/budget/page.tsx` | Add Apply Defaults button + modal |
| `lib/queries/monthly-budgets.ts` | Add `applyDefaultsToMonth()` function |
