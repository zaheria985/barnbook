import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSchedules,
  getSchedulesForHorse,
  createSchedule,
} from "@/lib/queries/treatment-schedules";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const horseId = request.nextUrl.searchParams.get("horse_id");
    const schedules = horseId
      ? await getSchedulesForHorse(horseId)
      : await getSchedules();
    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch treatment schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch treatment schedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const frequencyDays = Number(body.frequency_days);
    if (!body.frequency_days || !Number.isFinite(frequencyDays) || frequencyDays <= 0) {
      return NextResponse.json(
        { error: "frequency_days must be a positive number" },
        { status: 400 }
      );
    }

    const schedule = await createSchedule({
      name: body.name.trim(),
      frequency_days: frequencyDays,
      horse_id: body.horse_id ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      occurrence_count: body.occurrence_count != null ? Number(body.occurrence_count) : null,
      notes: body.notes ?? null,
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create treatment schedule:", error);
    return NextResponse.json(
      { error: "Failed to create treatment schedule" },
      { status: 500 }
    );
  }
}
