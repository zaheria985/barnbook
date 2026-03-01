import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHorse, updateHorse } from "@/lib/queries/horses";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "horse-photos");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const horse = await getHorse(id);
    if (!horse) {
      return NextResponse.json({ error: "Horse not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: jpg, png, webp" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Delete old photo if exists
    if (horse.photo_url) {
      const oldPath = path.join(process.cwd(), "public", horse.photo_url);
      try {
        await unlink(oldPath);
      } catch {
        // Old file may not exist, ignore
      }
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Save new photo
    const ext = EXT_MAP[file.type] || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const photo_url = `/uploads/horse-photos/${filename}`;
    await updateHorse(id, { photo_url });

    return NextResponse.json({ photo_url });
  } catch (error) {
    console.error("Failed to upload horse photo:", error);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const horse = await getHorse(id);
    if (!horse) {
      return NextResponse.json({ error: "Horse not found" }, { status: 404 });
    }

    if (horse.photo_url) {
      const filePath = path.join(process.cwd(), "public", horse.photo_url);
      try {
        await unlink(filePath);
      } catch {
        // File may not exist, ignore
      }
    }

    await updateHorse(id, { photo_url: null });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete horse photo:", error);
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
