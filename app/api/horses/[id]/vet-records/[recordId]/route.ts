import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateVetRecord, deleteVetRecord } from "@/lib/queries/vet-records";

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

    const data: {
      visit_date?: string;
      provider?: string | null;
      reason?: string | null;
      notes?: string | null;
      cost?: number | null;
    } = {};

    if (body.visit_date !== undefined) data.visit_date = body.visit_date;
    if (body.provider !== undefined) data.provider = body.provider?.trim() || null;
    if (body.reason !== undefined) data.reason = body.reason?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.cost !== undefined) data.cost = body.cost != null ? Number(body.cost) : null;

    const record = await updateVetRecord(recordId, data);

    if (!record) {
      return NextResponse.json(
        { error: "Vet record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Failed to update vet record:", error);
    return NextResponse.json(
      { error: "Failed to update vet record" },
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
    const deleted = await deleteVetRecord(recordId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Vet record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vet record:", error);
    return NextResponse.json(
      { error: "Failed to delete vet record" },
      { status: 500 }
    );
  }
}
