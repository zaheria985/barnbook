import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  updateFarrierRecord,
  deleteFarrierRecord,
} from "@/lib/queries/farrier-records";

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

    const data: Record<string, unknown> = {};
    if (body.visit_date !== undefined) data.visit_date = body.visit_date;
    if (body.provider !== undefined) data.provider = body.provider?.trim() || null;
    if (body.service_type !== undefined) data.service_type = body.service_type;
    if (body.findings !== undefined) data.findings = body.findings?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.cost !== undefined) data.cost = body.cost != null ? Number(body.cost) : null;

    const record = await updateFarrierRecord(recordId, data);

    if (!record) {
      return NextResponse.json(
        { error: "Farrier record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Failed to update farrier record:", error);
    return NextResponse.json(
      { error: "Failed to update farrier record" },
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
    const deleted = await deleteFarrierRecord(recordId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Farrier record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete farrier record:", error);
    return NextResponse.json(
      { error: "Failed to delete farrier record" },
      { status: 500 }
    );
  }
}
