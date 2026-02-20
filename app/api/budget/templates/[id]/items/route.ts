import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTemplateItems, setTemplateItem } from "@/lib/queries/budget-templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const items = await getTemplateItems(id);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch template items:", error);
    return NextResponse.json({ error: "Failed to fetch template items" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { categoryId, subItemId, amount } = await request.json();

    if (!categoryId || amount === undefined) {
      return NextResponse.json(
        { error: "categoryId and amount are required" },
        { status: 400 }
      );
    }

    const item = await setTemplateItem(id, categoryId, subItemId || null, Number(amount));
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to set template item:", error);
    return NextResponse.json({ error: "Failed to set template item" }, { status: 500 });
  }
}
