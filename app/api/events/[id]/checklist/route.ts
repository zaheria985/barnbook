import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChecklist, applyTemplate } from "@/lib/queries/event-checklists";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getChecklist(params.id);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch checklist:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.template_id) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }

    const items = await applyTemplate(params.id, body.template_id);
    return NextResponse.json(items, { status: 201 });
  } catch (error) {
    console.error("Failed to apply template:", error);
    return NextResponse.json({ error: "Failed to apply template" }, { status: 500 });
  }
}
