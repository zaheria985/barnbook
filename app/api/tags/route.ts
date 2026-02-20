import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTags, createTag } from "@/lib/queries/tags";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tagType = request.nextUrl.searchParams.get("type") || undefined;
    const tags = await getTags(tagType);
    return NextResponse.json(tags);
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, tagType, color, defaultCategoryId, defaultSubItemId } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const tag = await createTag({
      name: name.trim(),
      tagType: tagType || "label",
      color: color || null,
      defaultCategoryId: defaultCategoryId || null,
      defaultSubItemId: defaultSubItemId || null,
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Failed to create tag:", error);
    const msg = error instanceof Error && error.message.includes("unique")
      ? "A tag with that name already exists"
      : "Failed to create tag";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
