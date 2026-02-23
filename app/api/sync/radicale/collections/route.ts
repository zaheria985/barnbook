import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as radicale from "@/lib/radicale";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!radicale.isConfigured()) {
    return NextResponse.json(
      { configured: false, collections: [] },
      { status: 200 }
    );
  }

  try {
    const collections = await radicale.listCollections();
    return NextResponse.json({ configured: true, collections });
  } catch (error) {
    console.error("Failed to fetch Radicale collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

// POST: bootstrap default collections
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!radicale.isConfigured()) {
    return NextResponse.json(
      { error: "Radicale not configured" },
      { status: 503 }
    );
  }

  try {
    const defaults = await radicale.ensureDefaultCollections();
    return NextResponse.json({ success: true, collections: defaults });
  } catch (error) {
    console.error("Failed to create Radicale collections:", error);
    return NextResponse.json(
      { error: "Failed to create collections" },
      { status: 500 }
    );
  }
}
