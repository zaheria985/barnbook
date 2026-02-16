import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSchedule, createSlot } from "@/lib/queries/ride-schedule";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const schedule = await getSchedule();
    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.day_of_week == null || body.day_of_week < 0 || body.day_of_week > 6) {
      return NextResponse.json({ error: "day_of_week must be 0-6" }, { status: 400 });
    }
    if (!body.start_time || !body.end_time) {
      return NextResponse.json({ error: "start_time and end_time are required" }, { status: 400 });
    }

    const slot = await createSlot({
      day_of_week: Number(body.day_of_week),
      start_time: body.start_time,
      end_time: body.end_time,
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule slot:", error);
    return NextResponse.json({ error: "Failed to create schedule slot" }, { status: 500 });
  }
}
