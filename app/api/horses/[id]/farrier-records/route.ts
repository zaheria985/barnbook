import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getFarrierRecords,
  createFarrierRecord,
  getUnlinkedFarrierExpenses,
} from "@/lib/queries/farrier-records";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (request.nextUrl.searchParams.get("unlinked_expenses") === "1") {
      return NextResponse.json(await getUnlinkedFarrierExpenses(id));
    }
    const records = await getFarrierRecords(id);
    return NextResponse.json(records);
  } catch (error) {
    console.error("Failed to fetch farrier records:", error);
    return NextResponse.json(
      { error: "Failed to fetch farrier records" },
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

    const record = await createFarrierRecord({
      horse_id: id,
      visit_date: body.visit_date,
      next_due_date: body.next_due_date || null,
      provider: body.provider?.trim() || null,
      service_type: body.service_type || "trim",
      findings: body.findings?.trim() || null,
      notes: body.notes?.trim() || null,
      cost: body.cost != null ? Number(body.cost) : null,
      expense_id: body.expense_id || null,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Failed to create farrier record:", error);
    return NextResponse.json(
      { error: "Failed to create farrier record" },
      { status: 500 }
    );
  }
}
