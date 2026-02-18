// Weather rules engine for ride day scoring
// Scores each day as "green" (good), "yellow" (caution), or "red" (no-go)

import type { DayForecast, CurrentWeather } from "./openweathermap";
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

export function scoreDays(
  forecasts: DayForecast[],
  settings: WeatherSettings
): ScoredDay[] {
  return forecasts.map((f) => scoreDay(f, settings));
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
