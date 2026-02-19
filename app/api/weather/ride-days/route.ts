import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/queries/weather-settings";
import { isConfigured, getForecast, getRecentRain } from "@/lib/openweathermap";
import { scoreDays } from "@/lib/weather-rules";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "WeatherKit not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const settings = await getSettings();
    if (!settings?.location_lat || !settings?.location_lng) {
      return NextResponse.json(
        { error: "Location not configured" },
        { status: 400 }
      );
    }

    const lat = Number(settings.location_lat);
    const lng = Number(settings.location_lng);

    const [forecast, recentRain] = await Promise.all([
      getForecast(lat, lng),
      getRecentRain(lat, lng, settings.rain_window_hours).catch((err) => {
        console.error("Failed to fetch recent rain (footing scoring degraded):", err);
        return [];
      }),
    ]);

    const scored = scoreDays(forecast.daily, settings, recentRain, forecast.current);
    return NextResponse.json(scored);
  } catch (error) {
    console.error("Failed to score ride days:", error);
    return NextResponse.json({ error: "Failed to score ride days" }, { status: 500 });
  }
}
