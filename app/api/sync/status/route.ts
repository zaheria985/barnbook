import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as weatherkit from "@/lib/openweathermap";
import * as caldav from "@/lib/caldav";
import { isConfigured as radicaleConfigured } from "@/lib/radicale";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    weatherkit: {
      configured: weatherkit.isConfigured(),
    },
    email_ingest: {
      configured: !!process.env.EMAIL_INGEST_SECRET,
    },
    icloud: {
      configured: caldav.isConfigured(),
    },
    radicale: {
      configured: radicaleConfigured(),
    },
  });
}
