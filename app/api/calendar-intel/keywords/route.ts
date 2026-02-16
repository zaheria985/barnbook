import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKeywords, createKeyword } from "@/lib/queries/detection-keywords";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keywords = await getKeywords();
    return NextResponse.json(keywords);
  } catch (error) {
    console.error("Failed to fetch keywords:", error);
    return NextResponse.json({ error: "Failed to fetch keywords" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.keyword?.trim()) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }
    if (!body.suggested_event_type?.trim()) {
      return NextResponse.json({ error: "suggested_event_type is required" }, { status: 400 });
    }

    const keyword = await createKeyword({
      keyword: body.keyword.trim().toLowerCase(),
      suggested_event_type: body.suggested_event_type.trim(),
    });

    return NextResponse.json(keyword, { status: 201 });
  } catch (error) {
    console.error("Failed to create keyword:", error);
    return NextResponse.json({ error: "Failed to create keyword" }, { status: 500 });
  }
}
