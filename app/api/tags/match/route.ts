import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { matchVendorTag } from "@/lib/queries/tags";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = request.nextUrl.searchParams.get("vendor");
  if (!vendor) {
    return NextResponse.json({ error: "vendor param required" }, { status: 400 });
  }

  try {
    const tag = await matchVendorTag(vendor);
    if (!tag) {
      return NextResponse.json(null);
    }
    // Return in same format as /api/vendors/match for compatibility
    return NextResponse.json({
      id: tag.id,
      vendor_pattern: tag.name,
      category_id: tag.default_category_id,
      category_name: tag.default_category_name,
      sub_item_id: tag.default_sub_item_id,
      sub_item_label: tag.default_sub_item_label,
    });
  } catch (error) {
    console.error("Failed to match vendor tag:", error);
    return NextResponse.json({ error: "Failed to match" }, { status: 500 });
  }
}
