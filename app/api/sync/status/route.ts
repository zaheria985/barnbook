import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as vikunja from "@/lib/vikunja";
import * as weatherkit from "@/lib/openweathermap";
import * as caldav from "@/lib/caldav";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vikunjaHealth = await vikunja.checkHealth();

  return NextResponse.json({
    vikunja: {
      configured: vikunja.isConfigured(),
      connected: vikunjaHealth.ok,
      version: vikunjaHealth.version || null,
      error: vikunjaHealth.error || null,
    },
    weatherkit: {
      configured: weatherkit.isConfigured(),
    },
    email_ingest: {
      configured: !!process.env.EMAIL_INGEST_SECRET,
    },
    icloud: {
      configured: caldav.isConfigured(),
    },
  });
}
