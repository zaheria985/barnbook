import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveFailedIngest } from "@/lib/queries/failed-ingests";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await resolveFailedIngest(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to resolve failed ingest:", error);
    return NextResponse.json({ error: "Failed to resolve" }, { status: 500 });
  }
}
