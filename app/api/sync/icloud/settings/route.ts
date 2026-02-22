import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getIcloudSettings,
  updateIcloudSettings,
} from "@/lib/queries/icloud-sync";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getIcloudSettings();
  return NextResponse.json(settings || { read_calendar_ids: [], write_calendar_id: null, write_reminders_calendar_id: null });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { read_calendar_ids, write_calendar_id, write_reminders_calendar_id } = body;

    if (!Array.isArray(read_calendar_ids)) {
      return NextResponse.json(
        { error: "read_calendar_ids must be an array" },
        { status: 400 }
      );
    }

    const settings = await updateIcloudSettings(
      read_calendar_ids,
      write_calendar_id ?? null,
      write_reminders_calendar_id ?? null
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update iCloud settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
