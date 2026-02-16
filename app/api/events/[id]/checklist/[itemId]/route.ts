import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleChecklistItem } from "@/lib/queries/event-checklists";

export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const item = await toggleChecklistItem(params.itemId);
    if (!item) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to toggle checklist item:", error);
    return NextResponse.json({ error: "Failed to toggle checklist item" }, { status: 500 });
  }
}
