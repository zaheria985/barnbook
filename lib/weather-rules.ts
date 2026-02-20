// Weather rules engine for ride day scoring
// Scores each day as "green" (good), "yellow" (caution), or "red" (no-go)

import type { DayForecast, CurrentWeather, HourlyRain, HourlyForecast } from "./openweathermap";
import type { WeatherSettings } from "./queries/weather-settings";
import type { RideSlot } from "./queries/ride-schedule";

export type RideScore = "green" | "yellow" | "red";

export interface ScoredDay {
  date: string;
  score: RideScore;
  reasons: string[];
  notes: string[];
  forecast: DayForecast;
}

export interface WeatherAlert {
  type: "cold" | "heat" | "wind" | "rain" | "blanket";
  message: string;
  severity: RideScore;
}

export interface MoistureEstimate {
  current_moisture: number;
  hours_to_dry: number;
}

function evaporationRate(
  cloud_pct: number,
  temp_f: number,
  wind_mph: number,
  base_evap: number
): number {
  const sun_factor = 0.5 + (100 - cloud_pct) / 200;
  const temp_factor = 0.5 + temp_f / 140;
  const wind_factor = 1.0 + wind_mph / 30;
  return base_evap * sun_factor * temp_factor * wind_factor;
}

export function estimateMoisture(
  recentRain: HourlyRain[],
  currentWeather: CurrentWeather,
  forecastDays: DayForecast[],
  settings: WeatherSettings
): MoistureEstimate {
  const base_evap = 1.0 / settings.footing_dry_hours_per_inch;

  // Use today's forecast for drying conditions (fallback to current weather)
  const today = forecastDays[0];
  const cloud_pct = today?.clouds_pct ?? 50;
  const temp_f = today?.high_f ?? currentWeather.temperature_f;
  const wind_mph = today?.wind_speed_mph ?? currentWeather.wind_speed_mph;

  // Run simulation forward through historical hourly rain
  let moisture = 0;
  const evap = evaporationRate(cloud_pct, temp_f, wind_mph, base_evap);

  for (const entry of recentRain) {
    moisture += entry.rain_inches;
    moisture -= evap;
    if (moisture < 0) moisture = 0;
  }

  // Add current precipitation if actively raining
  moisture += currentWeather.precipitation_inches;

  // Estimate hours to dry at current evaporation rate
  const hours_to_dry = evap > 0 ? Math.ceil(moisture / evap) : moisture > 0 ? 999 : 0;

  return {
    current_moisture: Math.round(moisture * 100) / 100,
    hours_to_dry,
  };
}

export function estimateFutureMoisture(
  currentMoisture: number,
  dayIndex: number,
  forecastDays: DayForecast[],
  settings: WeatherSettings
): MoistureEstimate {
  const base_evap = 1.0 / settings.footing_dry_hours_per_inch;
  let moisture = currentMoisture;

  // Project forward through forecast days up to and including dayIndex
  for (let i = 0; i <= dayIndex && i < forecastDays.length; i++) {
    const day = forecastDays[i];
    // Add forecast rain for the day
    // Use higher of: forecast volume, or probability-weighted minimum
    // This ensures 80% rain chance adds at least 0.20" even if volume field is low
    if (i > 0 || dayIndex > 0) {
      const probRain = (day.precipitation_chance / 100) * settings.rain_cutoff_inches;
      const rainToAdd = Math.max(day.precipitation_inches, probRain);
      moisture += rainToAdd;
    }

    // Apply 24 hours of drying for each full day
    const hoursOfDrying = i < dayIndex ? 24 : 12; // partial day for the target day
    const evap = evaporationRate(day.clouds_pct, day.high_f, day.wind_speed_mph, base_evap);
    moisture -= evap * hoursOfDrying;
    if (moisture < 0) moisture = 0;
  }

  const targetDay = forecastDays[Math.min(dayIndex, forecastDays.length - 1)];
  const evap = evaporationRate(targetDay.clouds_pct, targetDay.high_f, targetDay.wind_speed_mph, base_evap);
  const hours_to_dry = evap > 0 ? Math.ceil(moisture / evap) : moisture > 0 ? 999 : 0;

  return {
    current_moisture: Math.round(moisture * 100) / 100,
    hours_to_dry,
  };
}

function escalate(current: RideScore, to: RideScore): RideScore {
  const rank = { green: 0, yellow: 1, red: 2 };
  return rank[to] > rank[current] ? to : current;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function formatHour12h(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12} ${suffix}`;
}

/** Summarize contiguous rain blocks from hourly data for a single day */
function summarizeRainWindow(
  dayHourly: HourlyForecast[],
  sunriseHour: number,
  sunsetHour: number
): string | null {
  if (dayHourly.length === 0) return null;

  // Find hours with rain (rain_inches > 0 or pop > 0.5)
  const rainHours = dayHourly
    .filter((h) => h.rain_inches > 0 || h.pop > 0.5)
    .map((h) => new Date(h.hour).getHours())
    .sort((a, b) => a - b);

  if (rainHours.length === 0) return null;

  // Group into contiguous blocks
  const blocks: { start: number; end: number }[] = [];
  let blockStart = rainHours[0];
  let blockEnd = rainHours[0];

  for (let i = 1; i < rainHours.length; i++) {
    if (rainHours[i] <= blockEnd + 1) {
      blockEnd = rainHours[i];
    } else {
      blocks.push({ start: blockStart, end: blockEnd + 1 });
      blockStart = rainHours[i];
      blockEnd = rainHours[i];
    }
  }
  blocks.push({ start: blockStart, end: blockEnd + 1 });

  // Check if all rain is outside daytime
  const allOvernight = blocks.every(
    (b) => b.end <= sunriseHour || b.start >= sunsetHour
  );
  if (allOvernight) {
    const times = blocks.map((b) => `${formatHour12h(b.start)}-${formatHour12h(b.end)}`);
    return `Rain overnight ${times.join(", ")}`;
  }

  // Check if rain covers most of the day
  const totalRainHours = rainHours.length;
  const totalDayHours = dayHourly.length;
  if (totalRainHours >= totalDayHours * 0.8) {
    return "Rain all day";
  }

  // Summarize blocks
  if (blocks.length <= 2) {
    const times = blocks
      .map((b) => `${formatHour12h(b.start)}-${formatHour12h(b.end)}`)
      .join(", ");
    return `Rain ${times}`;
  }

  return "Scattered showers throughout the day";
}

function checkDaytimeRain(
  dayDate: string,
  forecast: DayForecast,
  hourly: HourlyForecast[],
  rideSlots: RideSlot[],
  settings: WeatherSettings
): { skipDailyRain: boolean; reasons: string[]; notes: string[]; score: RideScore } {
  // Filter hourly data to this day
  const dayHourly = hourly.filter((h) => h.hour.startsWith(dayDate));
  if (dayHourly.length === 0) {
    return { skipDailyRain: false, reasons: [], notes: [], score: "green" };
  }

  // Filter to daytime hours (sunrise to sunset)
  const sunriseHour = forecast.sunrise ? new Date(forecast.sunrise).getHours() : 6;
  const sunsetHour = forecast.sunset ? new Date(forecast.sunset).getHours() : 20;
  const daytimeHourly = dayHourly.filter((h) => {
    const hour = new Date(h.hour).getHours();
    return hour >= sunriseHour && hour < sunsetHour;
  });

  // Get rain timing summary for the full day
  const rainSummary = summarizeRainWindow(dayHourly, sunriseHour, sunsetHour);

  if (daytimeHourly.length === 0) {
    const notes: string[] = [];
    // No daytime data but might have overnight rain
    if (rainSummary && rainSummary.startsWith("Rain overnight")) {
      notes.push(`${rainSummary} \u2014 daytime clear`);
    }
    return { skipDailyRain: true, reasons: [], notes, score: "green" };
  }

  const reasons: string[] = [];
  const notes: string[] = [];
  let score: RideScore = "green";

  // Daytime aggregate rain check with timing
  const daytimeRain = daytimeHourly.reduce((sum, h) => sum + h.rain_inches, 0);
  const daytimeMaxPop = Math.max(...daytimeHourly.map((h) => h.pop));
  const daytimeRainRounded = Math.round(daytimeRain * 100) / 100;

  if (daytimeRain >= settings.rain_cutoff_inches) {
    score = escalate(score, "red");
    const timing = rainSummary || "Rain during daytime";
    reasons.push(`${timing}: ${daytimeRainRounded}" expected`);
  } else if (daytimeMaxPop > 0.6) {
    score = escalate(score, "yellow");
    const timing = rainSummary ? ` (${rainSummary.toLowerCase()})` : "";
    reasons.push(`${Math.round(daytimeMaxPop * 100)}% chance of daytime rain${timing}`);
  }

  // Check for overnight-only rain (no daytime rain but rain exists)
  if (daytimeRain === 0 && rainSummary && rainSummary.startsWith("Rain overnight")) {
    notes.push(`${rainSummary} \u2014 daytime clear`);
  }

  // Slot-specific rain reasons (if ride slots exist for this day)
  const dayOfWeek = new Date(dayDate + "T12:00:00").getDay();
  const slotsForDay = rideSlots.filter((s) => s.day_of_week === dayOfWeek);

  for (const slot of slotsForDay) {
    const startHour = parseInt(slot.start_time.split(":")[0], 10);
    const endHour = parseInt(slot.end_time.split(":")[0], 10);
    const slotLabel = `${formatTime12h(slot.start_time)}-${formatTime12h(slot.end_time)}`;

    const slotHourly = daytimeHourly.filter((h) => {
      const hour = new Date(h.hour).getHours();
      return hour >= startHour && hour < endHour;
    });

    if (slotHourly.length === 0) continue;

    const totalRain = slotHourly.reduce((sum, h) => sum + h.rain_inches, 0);
    const maxPop = Math.max(...slotHourly.map((h) => h.pop));

    if (totalRain >= settings.rain_cutoff_inches) {
      score = escalate(score, "red");
      reasons.push(`Rain during your ${slotLabel} slot: ${totalRain}" expected`);
    } else if (maxPop > 0.6) {
      score = escalate(score, "yellow");
      reasons.push(`${Math.round(maxPop * 100)}% rain chance during ${slotLabel}`);
    }
  }

  return { skipDailyRain: true, reasons, notes, score };
}

export function scoreDays(
  forecasts: DayForecast[],
  settings: WeatherSettings,
  recentRain?: HourlyRain[],
  currentWeather?: CurrentWeather,
  hourly?: HourlyForecast[],
  rideSlots?: RideSlot[]
): ScoredDay[] {
  // Calculate today's moisture if we have rain data
  let todayMoisture: MoistureEstimate | undefined;
  if (recentRain && currentWeather) {
    todayMoisture = estimateMoisture(recentRain, currentWeather, forecasts, settings);
  }

  return forecasts.map((f, i) => {
    // For days 0-1 with hourly data, filter rain to daytime (sunrise-sunset)
    let scored: ScoredDay;
    if (i <= 1 && hourly && hourly.length > 0) {
      const hourlyResult = checkDaytimeRain(f.date, f, hourly, rideSlots ?? [], settings);
      scored = scoreDay(f, settings, hourlyResult.skipDailyRain);
      if (hourlyResult.reasons.length > 0) {
        scored.score = escalate(scored.score, hourlyResult.score);
        scored.reasons.unshift(...hourlyResult.reasons);
      }
      scored.notes.push(...hourlyResult.notes);
    } else {
      // Days 2+: no hourly data, use daily aggregates
      scored = scoreDay(f, settings, false, true);
    }

    // Add footing check
    if (todayMoisture && currentWeather) {
      const moisture = i === 0
        ? todayMoisture
        : estimateFutureMoisture(todayMoisture.current_moisture, i, forecasts, settings);

      if (moisture.current_moisture >= settings.footing_danger_inches) {
        scored.score = escalate(scored.score, "red");
        scored.reasons.unshift(
          `Footing unsafe \u2014 ${moisture.current_moisture}\u2033 moisture, ~${moisture.hours_to_dry}h to dry`
        );
      } else if (moisture.current_moisture >= settings.footing_caution_inches) {
        scored.score = escalate(scored.score, "yellow");
        scored.reasons.unshift(
          `Footing soft \u2014 ${moisture.current_moisture}\u2033 moisture, ~${moisture.hours_to_dry}h to dry`
        );
      }
    }

    // Replace default message if footing added a reason
    const defaultIdx = scored.reasons.indexOf("Good riding conditions");
    if (defaultIdx !== -1 && scored.reasons.length > 1) {
      scored.reasons.splice(defaultIdx, 1);
    }

    return scored;
  });
}

export function scoreDay(
  forecast: DayForecast,
  settings: WeatherSettings,
  skipRainCheck = false,
  noHourlyData = false
): ScoredDay {
  const reasons: string[] = [];
  const notes: string[] = [];
  let score: RideScore = "green";

  // Rain check (skipped when hourly time-aware check handled it)
  if (!skipRainCheck) {
    if (forecast.precipitation_inches >= settings.rain_cutoff_inches) {
      // Significant rain amount is material regardless of timing
      score = escalate(score, "red");
      reasons.push(`Rain: ${forecast.precipitation_inches}" expected`);
    } else if (forecast.precipitation_chance > 60) {
      score = escalate(score, "yellow");
      const timing = noHourlyData ? " (timing unavailable)" : "";
      const amount = forecast.precipitation_inches > 0
        ? `, ${forecast.precipitation_inches}" expected`
        : "";
      reasons.push(`${forecast.precipitation_chance}% chance of rain${amount}${timing}`);
    }
  }

  // Cold check (daytime temp for ride scoring)
  if (forecast.day_f <= settings.cold_alert_temp_f) {
    score = escalate(score, "red");
    reasons.push(`Cold: ${forecast.day_f}\u00B0F daytime`);
  } else if (forecast.day_f <= settings.cold_alert_temp_f + 10) {
    score = escalate(score, "yellow");
    reasons.push(`Chilly: ${forecast.day_f}\u00B0F daytime`);
  }

  // Heat check (daytime temp for ride scoring)
  if (forecast.day_f >= settings.heat_alert_temp_f) {
    score = escalate(score, "red");
    reasons.push(`Heat: ${forecast.day_f}\u00B0F daytime`);
  } else if (forecast.day_f >= settings.heat_alert_temp_f - 10) {
    score = escalate(score, "yellow");
    reasons.push(`Warm: ${forecast.day_f}\u00B0F daytime`);
  }

  // Blanket check (overnight low — side note, does NOT affect ride score)
  if (forecast.low_f <= settings.cold_alert_temp_f) {
    notes.push(`Overnight low ${forecast.low_f}\u00B0F \u2014 blanket needed`);
  }

  // Wind check
  if (forecast.wind_speed_mph >= settings.wind_cutoff_mph) {
    score = escalate(score, "red");
    reasons.push(`Wind: ${forecast.wind_speed_mph} mph`);
  } else if (forecast.wind_speed_mph >= settings.wind_cutoff_mph - 10) {
    score = escalate(score, "yellow");
    reasons.push(`Breezy: ${forecast.wind_speed_mph} mph`);
  }

  // Indoor arena override: red\u2192yellow if indoor available
  if (score === "red" && settings.has_indoor_arena) {
    const onlyWeatherIssue = reasons.every(
      (r) => r.startsWith("Rain:") || r.startsWith("Wind:") || r.includes("chance of rain")
    );
    if (onlyWeatherIssue) {
      score = "yellow";
      reasons.push("Indoor arena available");
    }
  }

  if (reasons.length === 0) {
    reasons.push("Good riding conditions");
  }

  return { date: forecast.date, score, reasons, notes, forecast };
}

export function getAlerts(
  current: CurrentWeather,
  settings: WeatherSettings
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (current.temperature_f <= settings.cold_alert_temp_f) {
    alerts.push({
      type: "cold",
      message: `Current temp ${current.temperature_f}\u00B0F \u2014 consider blanketing`,
      severity: "red",
    });
  } else if (current.temperature_f <= settings.cold_alert_temp_f + 10) {
    alerts.push({
      type: "blanket",
      message: `Temp dropping to ${current.temperature_f}\u00B0F \u2014 check blanket needs`,
      severity: "yellow",
    });
  }

  if (current.temperature_f >= settings.heat_alert_temp_f) {
    alerts.push({
      type: "heat",
      message: `Current temp ${current.temperature_f}\u00B0F \u2014 limit exercise, ensure water access`,
      severity: "red",
    });
  }

  if (current.wind_speed_mph >= settings.wind_cutoff_mph) {
    alerts.push({
      type: "wind",
      message: `Wind at ${current.wind_speed_mph} mph \u2014 secure loose items`,
      severity: "red",
    });
  }

  if (current.precipitation_inches > 0) {
    alerts.push({
      type: "rain",
      message: `Active precipitation \u2014 footing may be affected`,
      severity: "yellow",
    });
  }

  return alerts;
}
