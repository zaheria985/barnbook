import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  updateVaccineRecord,
  deleteVaccineRecord,
} from "@/lib/queries/vaccine-records";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { recordId } = await params;
    const body = await request.json();

    const data: Record<string, string | null> = {};
    if (body.vaccine_name !== undefined)
      data.vaccine_name = body.vaccine_name?.trim();
    if (body.date_administered !== undefined)
      data.date_administered = body.date_administered;
    if (body.next_due_date !== undefined)
      data.next_due_date = body.next_due_date || null;
    if (body.provider !== undefined)
      data.provider = body.provider?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    const record = await updateVaccineRecord(recordId, data);

    if (!record) {
      return NextResponse.json(
        { error: "Vaccine record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Failed to update vaccine record:", error);
    return NextResponse.json(
      { error: "Failed to update vaccine record" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { recordId } = await params;
    const deleted = await deleteVaccineRecord(recordId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Vaccine record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vaccine record:", error);
    return NextResponse.json(
      { error: "Failed to delete vaccine record" },
      { status: 500 }
    );
  }
}
