import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateHorse, deleteHorse } from "@/lib/queries/horses";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const horse = await updateHorse(id, {
      name: body.name?.trim(),
      weight_lbs: body.weight_lbs !== undefined ? body.weight_lbs : undefined,
      breed: body.breed !== undefined ? (body.breed?.trim() || null) : undefined,
      color: body.color !== undefined ? (body.color?.trim() || null) : undefined,
      date_of_birth: body.date_of_birth !== undefined ? (body.date_of_birth || null) : undefined,
      registration_number: body.registration_number !== undefined ? (body.registration_number?.trim() || null) : undefined,
    });

    if (!horse) {
      return NextResponse.json(
        { error: "Horse not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(horse);
  } catch (error) {
    console.error("Failed to update horse:", error);
    return NextResponse.json(
      { error: "Failed to update horse" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteHorse(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Horse not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete horse:", error);
    return NextResponse.json(
      { error: "Failed to delete horse" },
      { status: 500 }
    );
  }
}
