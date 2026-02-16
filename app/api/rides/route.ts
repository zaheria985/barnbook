import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRides, createRide } from "@/lib/queries/rides";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const month = request.nextUrl.searchParams.get("month") || undefined;
    const rider = request.nextUrl.searchParams.get("rider") || undefined;
    const horse = request.nextUrl.searchParams.get("horse") || undefined;

    const rides = await getRides({ month, rider_id: rider, horse_id: horse });
    return NextResponse.json(rides);
  } catch (error) {
    console.error("Failed to fetch rides:", error);
    return NextResponse.json(
      { error: "Failed to fetch rides" },
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

    if (
      !body.horse_id ||
      !body.date ||
      body.total_duration_minutes === undefined
    ) {
      return NextResponse.json(
        { error: "horse_id, date, and total_duration_minutes are required" },
        { status: 400 }
      );
    }

    const walkMin = Number(body.walk_minutes) || 0;
    const trotMin = Number(body.trot_minutes) || 0;
    const canterMin = Number(body.canter_minutes) || 0;
    const totalMin = Number(body.total_duration_minutes);

    if (walkMin + trotMin + canterMin !== totalMin) {
      return NextResponse.json(
        { error: "Gait minutes must sum to total duration" },
        { status: 400 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 400 }
      );
    }

    const validSources = ["manual", "watch"];
    const source = validSources.includes(body.source) ? body.source : "manual";

    const ride = await createRide({
      rider_id: userId,
      horse_id: body.horse_id,
      date: body.date,
      total_duration_minutes: totalMin,
      walk_minutes: walkMin,
      trot_minutes: trotMin,
      canter_minutes: canterMin,
      distance_miles: body.distance_miles != null ? Number(body.distance_miles) : null,
      notes: body.notes || null,
      source,
    });

    return NextResponse.json(ride, { status: 201 });
  } catch (error) {
    console.error("Failed to create ride:", error);
    return NextResponse.json(
      { error: "Failed to create ride" },
      { status: 500 }
    );
  }
}
