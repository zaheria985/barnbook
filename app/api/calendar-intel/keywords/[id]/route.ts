import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteKeyword } from "@/lib/queries/detection-keywords";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteKeyword(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete keyword:", error);
    return NextResponse.json({ error: "Failed to delete keyword" }, { status: 500 });
  }
}
