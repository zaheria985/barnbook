import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/queries/weather-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch weather settings:", error);
    return NextResponse.json({ error: "Failed to fetch weather settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settings = await updateSettings({
      location_lat: body.location_lat !== undefined ? body.location_lat : undefined,
      location_lng: body.location_lng !== undefined ? body.location_lng : undefined,
      rain_cutoff_inches: body.rain_cutoff_inches !== undefined ? Number(body.rain_cutoff_inches) : undefined,
      rain_window_hours: body.rain_window_hours !== undefined ? Number(body.rain_window_hours) : undefined,
      cold_alert_temp_f: body.cold_alert_temp_f !== undefined ? Number(body.cold_alert_temp_f) : undefined,
      heat_alert_temp_f: body.heat_alert_temp_f !== undefined ? Number(body.heat_alert_temp_f) : undefined,
      wind_cutoff_mph: body.wind_cutoff_mph !== undefined ? Number(body.wind_cutoff_mph) : undefined,
      has_indoor_arena: body.has_indoor_arena !== undefined ? body.has_indoor_arena : undefined,
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update weather settings:", error);
    return NextResponse.json({ error: "Failed to update weather settings" }, { status: 500 });
  }
}
