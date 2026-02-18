import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { matchVendor } from "@/lib/queries/vendor-mappings";

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
    const match = await matchVendor(vendor);
    return NextResponse.json(match);
  } catch (error) {
    console.error("Failed to match vendor:", error);
    return NextResponse.json({ error: "Failed to match vendor" }, { status: 500 });
  }
}
