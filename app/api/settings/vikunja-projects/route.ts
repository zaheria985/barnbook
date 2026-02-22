import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getProjectMap,
  upsertProjectMapping,
} from "@/lib/queries/vikunja-projects";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mappings = await getProjectMap();
  return NextResponse.json({ mappings });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "mappings must be an array" },
        { status: 400 }
      );
    }

    const validCategories = ["event_checklists", "weather_alerts"];
    const results = [];

    for (const mapping of mappings) {
      const { category, project_id } = mapping;

      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category: ${category}` },
          { status: 400 }
        );
      }

      if (!project_id || typeof project_id !== "number" || project_id <= 0) {
        return NextResponse.json(
          { error: `Invalid project_id for ${category}` },
          { status: 400 }
        );
      }

      const result = await upsertProjectMapping(category, project_id);
      results.push(result);
    }

    return NextResponse.json({ mappings: results });
  } catch (error) {
    console.error("Failed to update Vikunja project mappings:", error);
    return NextResponse.json(
      { error: "Failed to update project mappings" },
      { status: 500 }
    );
  }
}
