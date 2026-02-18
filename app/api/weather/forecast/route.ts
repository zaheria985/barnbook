import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/queries/weather-settings";
import { isConfigured, getForecast } from "@/lib/openweathermap";

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
        { error: "Location not configured. Set lat/lng in Weather Settings." },
        { status: 400 }
      );
    }

    const forecast = await getForecast(
      Number(settings.location_lat),
      Number(settings.location_lng)
    );
    return NextResponse.json(forecast);
  } catch (error) {
    console.error("Failed to fetch forecast:", error);
    return NextResponse.json({ error: "Failed to fetch forecast" }, { status: 500 });
  }
}
