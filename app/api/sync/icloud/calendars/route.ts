import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as caldav from "@/lib/caldav";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!caldav.isConfigured()) {
    return NextResponse.json(
      { error: "iCloud not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const calendars = await caldav.listCalendars();
    return NextResponse.json({ calendars }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to list iCloud calendars:", error);
    return NextResponse.json(
      { error: "Failed to connect to iCloud" },
      { status: 500 }
    );
  }
}
