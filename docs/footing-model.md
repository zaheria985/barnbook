# Footing Conditions Model

## Problem

Weather scoring only evaluated forecast data. If it rained heavily yesterday, the app would still say "Good riding conditions." On a dirt/clay arena, rain effects are cumulative (0.5" Monday + 0.3" Tuesday is worse than either alone), and drying speed varies dramatically between winter (overcast, slow) and summer (sunny, fast).

## Solution: Moisture Accumulation Model

Track an estimated ground moisture level that increases with rain events and decreases over time based on drying conditions.

### Data Sources

1. **Past 48h actual rain** via OWM timemachine endpoint (2 API calls, cached 24h each)
2. **Current precipitation** from the regular One Call response
3. **Drying conditions** from daily forecast: clouds, humidity, temperature, wind

### Simulation

For each hour in the lookback window:

```
moisture = 0
for each hour (oldest to newest):
    moisture += rain_this_hour
    moisture -= evaporation_rate
    moisture = max(moisture, 0)
```

### Evaporation Formula

```
sun_factor  = 0.5 + (100 - cloud_pct) / 200     // 0.5 (overcast) to 1.0 (clear)
temp_factor = 0.5 + temp_f / 140                  // 0.71 (30F) to 1.11 (85F)
wind_factor = 1.0 + wind_mph / 30                 // 1.0 (calm) to 2.0 (30mph)
evap_rate   = base_evap * sun * temp * wind
```

`base_evap = 1.0 / footing_dry_hours_per_inch`

### Calibration

Based on real observations from a dirt/clay arena:

**Winter (Feb, ~50F, 80% clouds, 8mph wind):**
- speed = 0.6 x 0.86 x 1.27 = 0.66
- effective evap = 0.017 x 0.66 = 0.011"/hr
- 0.54" rain dries in ~49 hours (observed: ~48h)

**Summer (clear, 85F, 10mph):**
- speed = 0.95 x 1.11 x 1.33 = 1.40
- effective evap = 0.017 x 1.40 = 0.024"/hr
- 0.54" dries in ~23 hours (matches: next morning)

### Scoring Thresholds

| Moisture Level | Score | Reason |
|---|---|---|
| < `footing_caution_inches` (0.25") | Green | Good footing |
| >= caution, < danger | Yellow | "Footing soft -- X" moisture, ~Yh to dry" |
| >= `footing_danger_inches` (0.75") | Red | "Footing unsafe -- X" moisture, ~Yh to dry" |

Future days use projected moisture (forecast rain + forecast drying conditions).

## Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `footing_caution_inches` | 0.25 | Yellow threshold (inches of moisture) |
| `footing_danger_inches` | 0.75 | Red threshold (inches of moisture) |
| `footing_dry_hours_per_inch` | 60 | Base drying rate in ideal conditions |

### Tuning Guide

- **Arena dries faster than expected?** Lower `footing_dry_hours_per_inch` (e.g., 40 for sandy arenas)
- **Arena dries slower?** Raise it (e.g., 80 for heavy clay)
- **Getting yellow too early?** Raise `footing_caution_inches` (e.g., 0.35)
- **Missing dangerous conditions?** Lower `footing_danger_inches` (e.g., 0.5)

## Implementation

- `lib/openweathermap.ts` — `getRecentRain()` fetches past 48h hourly rain via timemachine API
- `lib/weather-rules.ts` — `estimateMoisture()` runs the simulation; `scoreDays()` integrates footing scoring
- `app/api/weather/ride-days/route.ts` — fetches recent rain and passes to scoring
- `app/settings/weather/page.tsx` — UI for configuring thresholds and drying rate
- `db/migrations/008_footing_settings.sql` — adds columns to `weather_settings`
