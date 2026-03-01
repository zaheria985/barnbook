import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVetRecords, createVetRecord } from "@/lib/queries/vet-records";

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
    const records = await getVetRecords(id);
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch vet records:", error);
    return NextResponse.json(
      { error: "Failed to fetch vet records" },
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

    if (!body.visit_date) {
      return NextResponse.json(
        { error: "visit_date is required" },
        { status: 400 }
      );
    }

    const record = await createVetRecord({
      horse_id: id,
      visit_date: body.visit_date,
      provider: body.provider?.trim() || null,
      reason: body.reason?.trim() || null,
      notes: body.notes?.trim() || null,
      cost: body.cost != null ? Number(body.cost) : null,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Failed to create vet record:", error);
    return NextResponse.json(
      { error: "Failed to create vet record" },
      { status: 500 }
    );
  }
}
