// OpenWeatherMap One Call API 3.0 integration with graceful degradation
// Requires OPENWEATHERMAP_API_KEY

interface WeatherConditions {
  temperature_f: number;
  feels_like_f: number;
  humidity_percent: number;
  wind_speed_mph: number;
  wind_gust_mph: number;
  precipitation_chance: number;
  precipitation_inches: number;
  condition: string;
  uv_index: number;
}

export interface CurrentWeather extends WeatherConditions {
  as_of: string;
}

export interface DayForecast {
  date: string;
  high_f: number;
  low_f: number;
  precipitation_chance: number;
  precipitation_inches: number;
  wind_speed_mph: number;
  condition: string;
  sunrise: string;
  sunset: string;
}

export interface WeatherForecast {
  current: CurrentWeather;
  daily: DayForecast[];
}

// In-memory cache with 15-minute TTL
const cache: Map<string, { data: WeatherForecast; expires: number }> = new Map();
const CACHE_TTL = 15 * 60 * 1000;

export function isConfigured(): boolean {
  return !!process.env.OPENWEATHERMAP_API_KEY;
}

export async function getForecast(
  lat: number,
  lng: number
): Promise<WeatherForecast> {
  if (!isConfigured()) {
    throw new Error("OpenWeatherMap not configured. Set OPENWEATHERMAP_API_KEY environment variable.");
  }

  const cacheKey = `${lat},${lng}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const key = process.env.OPENWEATHERMAP_API_KEY!;
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&units=imperial&appid=${key}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenWeatherMap API error: ${res.status}`);
  }

  const raw = await res.json();
  const forecast = transformResponse(raw);

  cache.set(cacheKey, { data: forecast, expires: Date.now() + CACHE_TTL });

  return forecast;
}

function mmToInches(mm: number): number {
  return Math.round(mm / 25.4 * 100) / 100;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformResponse(raw: any): WeatherForecast {
  const cw = raw.current || {};
  const fd = raw.daily || [];

  // Rain/snow come in mm; convert to inches
  const currentRainMm = cw.rain?.["1h"] ?? 0;
  const currentSnowMm = cw.snow?.["1h"] ?? 0;
  const currentPrecipMm = currentRainMm + currentSnowMm;

  return {
    current: {
      temperature_f: Math.round(cw.temp ?? 0),
      feels_like_f: Math.round(cw.feels_like ?? 0),
      humidity_percent: cw.humidity ?? 0,
      wind_speed_mph: Math.round(cw.wind_speed ?? 0),
      wind_gust_mph: Math.round(cw.wind_gust ?? 0),
      precipitation_chance: currentPrecipMm > 0 ? 100 : 0,
      precipitation_inches: mmToInches(currentPrecipMm),
      condition: cw.weather?.[0]?.main ?? "Unknown",
      uv_index: Math.round(cw.uvi ?? 0),
      as_of: cw.dt ? new Date(cw.dt * 1000).toISOString() : new Date().toISOString(),
    },
    daily: fd.map((d: any) => {
      const dailyRainMm = d.rain ?? 0;
      const dailySnowMm = d.snow ?? 0;
      const dailyPrecipMm = dailyRainMm + dailySnowMm;

      return {
        date: d.dt ? new Date(d.dt * 1000).toISOString().split("T")[0] : "",
        high_f: Math.round(d.temp?.max ?? 0),
        low_f: Math.round(d.temp?.min ?? 0),
        precipitation_chance: Math.round((d.pop ?? 0) * 100),
        precipitation_inches: mmToInches(dailyPrecipMm),
        wind_speed_mph: Math.round(d.wind_speed ?? 0),
        condition: d.weather?.[0]?.main ?? "Unknown",
        sunrise: d.sunrise ? new Date(d.sunrise * 1000).toISOString() : "",
        sunset: d.sunset ? new Date(d.sunset * 1000).toISOString() : "",
      };
    }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
