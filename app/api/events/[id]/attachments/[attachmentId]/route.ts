import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteAttachment } from "@/lib/queries/event-attachments";
import { unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads/event-attachments");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attachmentId } = await params;
    const filename = await deleteAttachment(attachmentId);

    if (!filename) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Clean up file from disk
    try {
      await unlink(path.join(UPLOAD_DIR, filename));
    } catch {
      // File may already be gone — not critical
      console.warn("Could not delete file from disk:", filename);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}
