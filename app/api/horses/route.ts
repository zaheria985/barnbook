import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHorses, createHorse } from "@/lib/queries/horses";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const horses = await getHorses();
    return NextResponse.json(horses);
  } catch (error) {
    console.error("Failed to fetch horses:", error);
    return NextResponse.json(
      { error: "Failed to fetch horses" },
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

    const horse = await createHorse({
      name: body.name.trim(),
      weight_lbs: body.weight_lbs != null ? Number(body.weight_lbs) : null,
      breed: body.breed?.trim() || null,
      color: body.color?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      registration_number: body.registration_number?.trim() || null,
    });

    return NextResponse.json(horse, { status: 201 });
  } catch (error) {
    console.error("Failed to create horse:", error);
    return NextResponse.json(
      { error: "Failed to create horse" },
      { status: 500 }
    );
  }
}
