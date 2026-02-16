// WeatherKit API integration with graceful degradation
// Requires WEATHERKIT_TEAM_ID, WEATHERKIT_SERVICE_ID, WEATHERKIT_KEY_ID, WEATHERKIT_PRIVATE_KEY

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
  return !!(
    process.env.WEATHERKIT_TEAM_ID &&
    process.env.WEATHERKIT_SERVICE_ID &&
    process.env.WEATHERKIT_KEY_ID &&
    process.env.WEATHERKIT_PRIVATE_KEY
  );
}

export async function getForecast(
  lat: number,
  lng: number
): Promise<WeatherForecast> {
  if (!isConfigured()) {
    throw new Error("WeatherKit not configured. Set WEATHERKIT_* environment variables.");
  }

  const cacheKey = `${lat},${lng}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const token = await generateJWT();
  const url = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lng}?dataSets=currentWeather,forecastDaily`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`WeatherKit API error: ${res.status}`);
  }

  const raw = await res.json();
  const forecast = transformResponse(raw);

  cache.set(cacheKey, { data: forecast, expires: Date.now() + CACHE_TTL });

  return forecast;
}

async function generateJWT(): Promise<string> {
  // Apple WeatherKit uses ES256 JWT
  // This requires the jsonwebtoken or jose library
  // For now, use a simplified approach
  const teamId = process.env.WEATHERKIT_TEAM_ID!;
  const serviceId = process.env.WEATHERKIT_SERVICE_ID!;
  const keyId = process.env.WEATHERKIT_KEY_ID!;
  const privateKey = process.env.WEATHERKIT_PRIVATE_KEY!;

  // Dynamic import to avoid build errors when not configured
  try {
    const crypto = await import("crypto");
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(
      JSON.stringify({ alg: "ES256", kid: keyId, id: `${teamId}.${serviceId}` })
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({
        iss: teamId,
        iat: now,
        exp: now + 3600,
        sub: serviceId,
      })
    ).toString("base64url");

    const sign = crypto.createSign("SHA256");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKey, "base64url");

    return `${header}.${payload}.${signature}`;
  } catch {
    throw new Error("Failed to generate WeatherKit JWT");
  }
}

function celsiusToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function mmToInches(mm: number): number {
  return Math.round(mm / 25.4 * 100) / 100;
}

function mpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformResponse(raw: any): WeatherForecast {
  const cw = raw.currentWeather || {};
  const fd = raw.forecastDaily?.days || [];

  return {
    current: {
      temperature_f: celsiusToF(cw.temperature ?? 0),
      feels_like_f: celsiusToF(cw.temperatureApparent ?? 0),
      humidity_percent: Math.round((cw.humidity ?? 0) * 100),
      wind_speed_mph: mpsToMph(cw.windSpeed ?? 0),
      wind_gust_mph: mpsToMph(cw.windGust ?? 0),
      precipitation_chance: Math.round((cw.precipitationIntensity ?? 0) > 0 ? 100 : 0),
      precipitation_inches: mmToInches(cw.precipitationIntensity ?? 0),
      condition: cw.conditionCode ?? "Unknown",
      uv_index: cw.uvIndex ?? 0,
      as_of: cw.asOf ?? new Date().toISOString(),
    },
    daily: fd.map((d: any) => ({
      date: d.forecastStart?.split("T")[0] ?? "",
      high_f: celsiusToF(d.temperatureMax ?? 0),
      low_f: celsiusToF(d.temperatureMin ?? 0),
      precipitation_chance: Math.round((d.precipitationChance ?? 0) * 100),
      precipitation_inches: mmToInches(d.precipitationAmount ?? 0),
      wind_speed_mph: mpsToMph(d.windSpeedAvg ?? 0),
      condition: d.conditionCode ?? "Unknown",
      sunrise: d.sunrise ?? "",
      sunset: d.sunset ?? "",
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
