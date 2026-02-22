import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as vikunja from "@/lib/vikunja";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!vikunja.isConfigured()) {
    return NextResponse.json({ projects: [] });
  }

  try {
    const projects = await vikunja.getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch Vikunja projects:", error);
    return NextResponse.json({ projects: [] });
  }
}
