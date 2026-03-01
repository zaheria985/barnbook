import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getVaccineRecords,
  createVaccineRecord,
} from "@/lib/queries/vaccine-records";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const records = await getVaccineRecords(id);
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch vaccine records:", error);
    return NextResponse.json(
      { error: "Failed to fetch vaccine records" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.vaccine_name?.trim()) {
      return NextResponse.json(
        { error: "vaccine_name is required" },
        { status: 400 }
      );
    }
    if (!body.date_administered) {
      return NextResponse.json(
        { error: "date_administered is required" },
        { status: 400 }
      );
    }

    const record = await createVaccineRecord({
      horse_id: id,
      vaccine_name: body.vaccine_name.trim(),
      date_administered: body.date_administered,
      next_due_date: body.next_due_date || null,
      provider: body.provider?.trim() || null,
      notes: body.notes?.trim() || null,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Failed to create vaccine record:", error);
    return NextResponse.json(
      { error: "Failed to create vaccine record" },
      { status: 500 }
    );
  }
}
