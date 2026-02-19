// Weather rules engine for ride day scoring
// Scores each day as "green" (good), "yellow" (caution), or "red" (no-go)

import type { DayForecast, CurrentWeather, HourlyRain } from "./openweathermap";
import type { WeatherSettings } from "./queries/weather-settings";

export type RideScore = "green" | "yellow" | "red";

export interface ScoredDay {
  date: string;
  score: RideScore;
  reasons: string[];
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
    if (i > 0 || dayIndex > 0) {
      moisture += day.precipitation_inches;
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

export function scoreDays(
  forecasts: DayForecast[],
  settings: WeatherSettings,
  recentRain?: HourlyRain[],
  currentWeather?: CurrentWeather
): ScoredDay[] {
  // Calculate today's moisture if we have rain data
  let todayMoisture: MoistureEstimate | undefined;
  if (recentRain && currentWeather) {
    todayMoisture = estimateMoisture(recentRain, currentWeather, forecasts, settings);
  }

  return forecasts.map((f, i) => {
    const scored = scoreDay(f, settings);

    // Add footing check
    if (todayMoisture && currentWeather) {
      const moisture = i === 0
        ? todayMoisture
        : estimateFutureMoisture(todayMoisture.current_moisture, i, forecasts, settings);

      if (moisture.current_moisture >= settings.footing_danger_inches) {
        scored.score = escalate(scored.score, "red");
        scored.reasons.unshift(
          `Footing unsafe \u2014 ${moisture.current_moisture}\u201D moisture, ~${moisture.hours_to_dry}h to dry`
        );
      } else if (moisture.current_moisture >= settings.footing_caution_inches) {
        scored.score = escalate(scored.score, "yellow");
        scored.reasons.unshift(
          `Footing soft \u2014 ${moisture.current_moisture}\u201D moisture, ~${moisture.hours_to_dry}h to dry`
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

function escalate(current: RideScore, to: RideScore): RideScore {
  const rank = { green: 0, yellow: 1, red: 2 };
  return rank[to] > rank[current] ? to : current;
}

export function scoreDay(
  forecast: DayForecast,
  settings: WeatherSettings
): ScoredDay {
  const reasons: string[] = [];
  let score: RideScore = "green";

  // Rain check
  if (forecast.precipitation_inches >= settings.rain_cutoff_inches) {
    score = escalate(score, "red");
    reasons.push(`Rain: ${forecast.precipitation_inches}" expected`);
  } else if (forecast.precipitation_chance > 60) {
    score = escalate(score, "yellow");
    reasons.push(`${forecast.precipitation_chance}% chance of rain`);
  }

  // Cold check
  if (forecast.low_f <= settings.cold_alert_temp_f) {
    score = escalate(score, "red");
    reasons.push(`Cold: low of ${forecast.low_f}°F`);
  } else if (forecast.low_f <= settings.cold_alert_temp_f + 10) {
    score = escalate(score, "yellow");
    reasons.push(`Chilly: low of ${forecast.low_f}°F`);
  }

  // Heat check
  if (forecast.high_f >= settings.heat_alert_temp_f) {
    score = escalate(score, "red");
    reasons.push(`Heat: high of ${forecast.high_f}°F`);
  } else if (forecast.high_f >= settings.heat_alert_temp_f - 10) {
    score = escalate(score, "yellow");
    reasons.push(`Warm: high of ${forecast.high_f}°F`);
  }

  // Wind check
  if (forecast.wind_speed_mph >= settings.wind_cutoff_mph) {
    score = escalate(score, "red");
    reasons.push(`Wind: ${forecast.wind_speed_mph} mph`);
  } else if (forecast.wind_speed_mph >= settings.wind_cutoff_mph - 10) {
    score = escalate(score, "yellow");
    reasons.push(`Breezy: ${forecast.wind_speed_mph} mph`);
  }

  // Indoor arena override: red→yellow if indoor available
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

  return { date: forecast.date, score, reasons, forecast };
}

export function getAlerts(
  current: CurrentWeather,
  settings: WeatherSettings
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (current.temperature_f <= settings.cold_alert_temp_f) {
    alerts.push({
      type: "cold",
      message: `Current temp ${current.temperature_f}°F — consider blanketing`,
      severity: "red",
    });
  } else if (current.temperature_f <= settings.cold_alert_temp_f + 10) {
    alerts.push({
      type: "blanket",
      message: `Temp dropping to ${current.temperature_f}°F — check blanket needs`,
      severity: "yellow",
    });
  }

  if (current.temperature_f >= settings.heat_alert_temp_f) {
    alerts.push({
      type: "heat",
      message: `Current temp ${current.temperature_f}°F — limit exercise, ensure water access`,
      severity: "red",
    });
  }

  if (current.wind_speed_mph >= settings.wind_cutoff_mph) {
    alerts.push({
      type: "wind",
      message: `Wind at ${current.wind_speed_mph} mph — secure loose items`,
      severity: "red",
    });
  }

  if (current.precipitation_inches > 0) {
    alerts.push({
      type: "rain",
      message: `Active precipitation — footing may be affected`,
      severity: "yellow",
    });
  }

  return alerts;
}
