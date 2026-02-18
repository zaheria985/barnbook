import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getIncomeCategories,
  createIncomeCategory,
} from "@/lib/queries/income";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await getIncomeCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch income categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch income categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await createIncomeCategory(name.trim());
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create income category:", error);
    return NextResponse.json(
      { error: "Failed to create income category" },
      { status: 500 }
    );
  }
}
