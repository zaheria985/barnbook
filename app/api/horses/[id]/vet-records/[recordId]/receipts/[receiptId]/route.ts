import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteReceipt } from "@/lib/queries/vet-receipts";
import { unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "vet-receipts");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string; receiptId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { receiptId } = await params;
    const result = await deleteReceipt(receiptId);

    if (!result) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Delete file from disk (best effort)
    try {
      await unlink(path.join(UPLOAD_DIR, result.filename));
    } catch (fsError) {
      console.warn("Failed to delete receipt file:", fsError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete receipt:", error);
    return NextResponse.json(
      { error: "Failed to delete receipt" },
      { status: 500 }
    );
  }
}
