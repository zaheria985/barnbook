import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listFailedIngests } from "@/lib/queries/failed-ingests";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const failed = await listFailedIngests();
    return NextResponse.json(failed);
  } catch (error) {
    console.error("Failed to list failed ingests:", error);
    return NextResponse.json({ error: "Failed to list failed ingests" }, { status: 500 });
  }
}
