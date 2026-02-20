import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cloneTemplate } from "@/lib/queries/budget-templates";

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
    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await cloneTemplate(id, name.trim());
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to clone template:", error);
    return NextResponse.json({ error: "Failed to clone template" }, { status: 500 });
  }
}
