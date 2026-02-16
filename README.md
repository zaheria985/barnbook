# Barnbook

A self-hosted equestrian management app for budget tracking, ride logging with gait detection, calendar planning, and weather-aware scheduling — built for riders who want full control of their data.

![Dashboard](docs/screenshots/dashboard.png)

## Features

- **Budget Tracking** — Monthly budgets with category breakdowns, spending charts, and savings goals
- **Income Management** — Track income sources with recurring entry support and year-over-year comparison
- **Ride Logging** — Record rides with gait breakdowns (walk/trot/canter), duration, calories, and horse-specific stats
- **Gait Detection** — Automatic walk/trot/canter classification via accelerometer on Apple Watch
- **Calendar & Events** — Monthly calendar with color-coded event types, ride scheduling, and day detail views
- **Weather Integration** — Apple WeatherKit forecasts for ride planning with temperature, wind, and conditions
- **Checklists** — Daily/weekly barn checklists with optional Vikunja sync for shared task management
- **Email Ingest** — Forward receipts via email webhook to auto-create budget transactions
- **Apple Watch App** — Standalone watchOS companion with GPS tracking, heart rate, and offline sync
- **Dark Mode** — Full light/dark theme with system preference detection
- **Self-Hosted** — Docker Compose stack with PostgreSQL, zero external dependencies required

<details>
<summary>More screenshots</summary>

![Budget](docs/screenshots/budget.png)
![Rides](docs/screenshots/rides.png)
![Calendar](docs/screenshots/calendar.png)

</details>

## Tech Stack

- **Framework** — Next.js 14 (App Router, standalone output)
- **Database** — PostgreSQL 16
- **Auth** — NextAuth.js 4 with JWT + bcrypt credentials
- **Styling** — Tailwind CSS with CSS custom properties for theming
- **Charts** — Recharts
- **Tables** — TanStack Table
- **Watch** — Native watchOS 10+ (Swift, CoreMotion, HealthKit, CoreLocation)

## Docker Quick Start (Recommended)

1. Clone and enter the repo:

```bash
git clone https://github.com/zaheria985/barnbook.git
cd barnbook
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Set at least:
- `DB_PASSWORD` (choose any password for the database)
- `NEXTAUTH_SECRET` (run `openssl rand -base64 32` to generate one)
- `NEXTAUTH_URL` (for local Docker use `http://localhost:3500`)

4. Start the stack (app + PostgreSQL):

```bash
docker compose pull
docker compose up -d
```

5. Open `http://localhost:3500`

**Default login:**
- Email: `rider@barnbook.local`
- Password: `barnbook123`

On first startup the app container automatically:
- Waits for Postgres to be ready
- Applies the full schema if the database is empty
- Runs any pending migrations
- Seeds a default login account (disable with `SEED_DEFAULT_USER=0`)

## Docker Compose Options

### Option A: App + Database (default)

The default `docker-compose.yml` runs both the app and PostgreSQL:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: barnbook
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: barnbook
    volumes:
      - barnbook_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barnbook -d barnbook"]
      interval: 5s
      timeout: 3s
      retries: 20

  app:
    image: ${APP_IMAGE:-ghcr.io/zaheria985/barnbook:latest}
    build: .
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://barnbook:${DB_PASSWORD}@db:5432/barnbook
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      BOOTSTRAP_SCHEMA: ${BOOTSTRAP_SCHEMA:-1}
      SEED_DEFAULT_USER: ${SEED_DEFAULT_USER:-1}
    ports:
      - "${APP_PORT:-3500}:3500"

volumes:
  barnbook_data:
```

Run it:

```bash
docker compose pull
docker compose up -d
```

### Option B: App-only (external PostgreSQL)

If you already have a PostgreSQL server, run just the app:

```yaml
services:
  app:
    image: ${APP_IMAGE:-ghcr.io/zaheria985/barnbook:latest}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://user:pass@your-db-host:5432/barnbook
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      BOOTSTRAP_SCHEMA: "1"
      SEED_DEFAULT_USER: "1"
    ports:
      - "3500:3500"
```

Set `DATABASE_URL` to your external PostgreSQL connection string.

### Option C: Unraid (Compose Manager)

Paste this into the Unraid Docker Compose Manager stack editor:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: barnbook
      POSTGRES_PASSWORD: barnbook
      POSTGRES_DB: barnbook
    volumes:
      - /mnt/user/appdata/barnbook/db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barnbook -d barnbook"]
      interval: 5s
      timeout: 3s
      retries: 20

  app:
    image: ghcr.io/zaheria985/barnbook:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://barnbook:barnbook@db:5432/barnbook
      NEXTAUTH_SECRET: change-me-to-a-random-string
      NEXTAUTH_URL: http://YOUR_UNRAID_IP:3500
      BOOTSTRAP_SCHEMA: "1"
      SEED_DEFAULT_USER: "1"
    ports:
      - "3500:3500"
```

Replace `YOUR_UNRAID_IP` with your server's IP address (e.g. `192.168.1.100`).

## Docker Image Publishing

- Image: `ghcr.io/zaheria985/barnbook`
- `latest` is published automatically from `main` via `.github/workflows/docker-publish.yml`.
- Every publish also includes a short SHA tag.

If you want to build locally instead of pulling the prebuilt image:

```bash
docker compose up --build -d
```

## Local Dev (Without Docker)

1. Install dependencies:

```bash
npm install
```

2. Copy environment config:

```bash
cp .env.example .env
```

3. Set required values in `.env`:
- `DATABASE_URL` (pointing to a running PostgreSQL instance)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (use `http://localhost:3100` for dev)

4. Apply database schema and migrations:

```bash
npm run db:migrate
```

5. Start development server:

```bash
npm run dev
```

Visit `http://localhost:3100`.

## Key Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run local dev server (port 3100) |
| `npm run build` | Build production app |
| `npm run lint` | Run lint checks |
| `npm run db:migrate` | Apply schema and SQL migrations |
| `npm run db:seed` | Seed sample data |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DB_PASSWORD` | Yes (Docker) | PostgreSQL password for Docker Compose |
| `NEXTAUTH_SECRET` | Yes | Session encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | App base URL (e.g. `http://localhost:3500`) |
| `BOOTSTRAP_SCHEMA` | No | Auto-apply schema on first run (default: `1`) |
| `SEED_DEFAULT_USER` | No | Seed default login on first run (default: `1`) |
| `APP_PORT` | No | Host port mapping (default: `3500`) |
| `VIKUNJA_URL` | No | Vikunja instance URL for checklist sync |
| `VIKUNJA_API_TOKEN` | No | Vikunja API bearer token |
| `VIKUNJA_PROJECT_ID` | No | Vikunja project ID for Barnbook |
| `WEATHERKIT_KEY_ID` | No | Apple WeatherKit key ID |
| `WEATHERKIT_TEAM_ID` | No | Apple Developer team ID |
| `WEATHERKIT_SERVICE_ID` | No | WeatherKit service identifier |
| `WEATHERKIT_PRIVATE_KEY` | No | WeatherKit private key (base64) |
| `EMAIL_INGEST_SECRET` | No | Shared secret for email webhook |

Optional integrations (Vikunja, WeatherKit, email) work without configuration — features gracefully degrade when credentials are not set.

## Apple Watch Companion

The `watch/` directory contains a standalone watchOS 10+ app for ride tracking:

- **Gait Detection** — Accelerometer-based walk/trot/canter classification in real time
- **GPS Tracking** — Distance and route recording via CoreLocation
- **Heart Rate** — Live BPM monitoring through HealthKit workout sessions
- **Offline Sync** — Rides queue locally and sync to the web API when connectivity returns
- **Calorie Estimates** — Rider and horse calorie calculations matching the web app formulas

Open `watch/Barnbook.xcodeproj` in Xcode 15+ to build and deploy. Requires macOS 14+ and an Apple Developer account for device deployment.

## Database Notes

- PostgreSQL 16 is required.
- Schema source is `db/schema.sql`.
- Migrations are tracked in `db/migrations/` and applied by `db/migrate.js`.
- On first Docker startup, `db/bootstrap.js` auto-applies the schema and seeds.

## Troubleshooting

- **Login loop or auth failures:**
  - Verify `NEXTAUTH_URL` matches the URL you open in the browser.
  - Ensure `NEXTAUTH_SECRET` is set and stable across restarts.
- **Database connection errors:**
  - Confirm PostgreSQL is running and healthy.
  - Verify `DATABASE_URL` credentials and host/port.
- **Missing tables or columns:**
  - Run `npm run db:migrate` (or restart the Docker container, which runs migrations automatically).
- **Integrations not working:**
  - Check that the relevant environment variables are set (Vikunja, WeatherKit, etc.).
  - Features degrade gracefully — missing credentials won't break the app.
