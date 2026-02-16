import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVendorMappings, createMapping } from "@/lib/queries/vendor-mappings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mappings = await getVendorMappings();
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to fetch vendor mappings:", error);
    return NextResponse.json({ error: "Failed to fetch vendor mappings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.vendor_pattern?.trim()) {
      return NextResponse.json({ error: "vendor_pattern is required" }, { status: 400 });
    }
    if (!body.category_id) {
      return NextResponse.json({ error: "category_id is required" }, { status: 400 });
    }

    const mapping = await createMapping({
      vendor_pattern: body.vendor_pattern.trim(),
      category_id: body.category_id,
      sub_item_id: body.sub_item_id || null,
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("Failed to create vendor mapping:", error);
    return NextResponse.json({ error: "Failed to create vendor mapping" }, { status: 500 });
  }
}
