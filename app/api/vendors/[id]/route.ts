import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateMapping, deleteMapping } from "@/lib/queries/vendor-mappings";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mapping = await updateMapping(params.id, {
      vendor_pattern: body.vendor_pattern?.trim(),
      category_id: body.category_id,
      sub_item_id: body.sub_item_id,
    });

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }
    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Failed to update vendor mapping:", error);
    return NextResponse.json({ error: "Failed to update vendor mapping" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteMapping(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vendor mapping:", error);
    return NextResponse.json({ error: "Failed to delete vendor mapping" }, { status: 500 });
  }
}
