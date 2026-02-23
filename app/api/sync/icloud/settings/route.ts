import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getIcloudSettings,
  updateIcloudSettings,
} from "@/lib/queries/icloud-sync";
import pool from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getIcloudSettings();
  return NextResponse.json(settings || {
    read_calendar_ids: [],
    write_calendar_id: null,
    reminders_checklists_id: null,
    reminders_weather_id: null,
    reminders_treatments_id: null,
    use_radicale: false,
    radicale_checklists_collection: null,
    radicale_weather_collection: null,
    radicale_treatments_collection: null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      read_calendar_ids, write_calendar_id,
      reminders_checklists_id, reminders_weather_id, reminders_treatments_id,
      use_radicale, radicale_checklists_collection, radicale_weather_collection, radicale_treatments_collection
    } = body;

    if (!Array.isArray(read_calendar_ids)) {
      return NextResponse.json(
        { error: "read_calendar_ids must be an array" },
        { status: 400 }
      );
    }

    // If switching TO Radicale, clear old iCloud reminder_uids so the sync
    // re-creates them in Radicale on the next run
    const oldSettings = await getIcloudSettings();
    const switchingToRadicale = (use_radicale ?? false) && !oldSettings?.use_radicale;

    const settings = await updateIcloudSettings(
      read_calendar_ids,
      write_calendar_id ?? null,
      reminders_checklists_id ?? null,
      reminders_weather_id ?? null,
      reminders_treatments_id ?? null,
      use_radicale ?? false,
      radicale_checklists_collection ?? null,
      radicale_weather_collection ?? null,
      radicale_treatments_collection ?? null
    );

    if (switchingToRadicale) {
      await Promise.all([
        pool.query(`UPDATE events SET reminder_uid = NULL WHERE reminder_uid IS NOT NULL`),
        pool.query(`UPDATE event_checklists SET reminder_uid = NULL WHERE reminder_uid IS NOT NULL`),
        pool.query(`DELETE FROM blanket_reminders`),
        pool.query(`DELETE FROM treatment_reminders`),
      ]);
    }

    return NextResponse.json({ ...settings, reminders_reset: switchingToRadicale });
  } catch (error) {
    console.error("Failed to update iCloud settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
