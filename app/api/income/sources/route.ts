import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getIncomeSources,
  createIncomeSource,
} from "@/lib/queries/income";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sources = await getIncomeSources();
    return NextResponse.json(sources);
  } catch (error) {
    console.error("Failed to fetch income sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch income sources" },
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
        { error: "Source name is required" },
        { status: 400 }
      );
    }

    const source = await createIncomeSource(name.trim());
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Failed to create income source:", error);
    return NextResponse.json(
      { error: "Failed to create income source" },
      { status: 500 }
    );
  }
}
