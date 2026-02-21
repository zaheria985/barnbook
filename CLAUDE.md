# CLAUDE.md

## Project
Barnbook — Next.js 14 equestrian management app (TypeScript, PostgreSQL, Tailwind CSS)

## Commands
- `npx next build` — type-check + build (no test suite; this is the verification step)
- `npm run db:migrate` — run migrations (requires DATABASE_URL)

## Architecture
- DB queries: `lib/queries/*.ts` — each domain has its own query file
- API routes: `app/api/` — Next.js route handlers
- Pages: `app/` — client components with `"use client"`
- Weather: `lib/openweathermap.ts` (API client), `lib/weather-rules.ts` (scoring engine)
- CalDAV: `lib/caldav.ts` — iCloud calendar read/write
- Migrations: `db/migrations/NNN_name.sql` — numbered sequentially

## Gotchas
- **Date formatting**: PostgreSQL DATE values JSON-serialize as `"2026-02-21T00:00:00.000Z"`. Always use `.split("T")[0]` before appending `"T00:00:00"` for client-side Date parsing.
- **Timezone**: OpenWeatherMap timestamps are UTC. Use `getLocalHour(isoTimestamp, tzOffset)` from `lib/openweathermap.ts` — never raw `new Date(iso).getHours()`.
- **Route params**: Use `{ params }: { params: Promise<{ id: string }> }` with `await params` (not direct destructuring).

## Conventions
- CSS uses design token variables (`var(--interactive)`, `var(--success-text)`, etc.), not Tailwind color classes
- Event types: show, vet, farrier, lesson, pony_club, ride, other — when adding types, update labels/badges in `EventCard.tsx`, `digest/page.tsx`
- No semicolon-free style — standard TypeScript with semicolons
- Prefer `Promise.all()` for parallel independent queries in API routes
