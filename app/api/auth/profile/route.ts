import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import pool from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pool.query(
    "SELECT id, name, email, weight_lbs FROM users WHERE id = $1",
    [session.user.id]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const weightInput = body?.weight_lbs;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let weight_lbs: number | null = null;
    if (weightInput !== undefined && weightInput !== null) {
      const raw = String(weightInput).trim();
      if (raw !== "") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return NextResponse.json(
            { error: "Weight must be a positive number" },
            { status: 400 }
          );
        }
        weight_lbs = Math.round(parsed);
      }
    }

    const result = await pool.query(
      "UPDATE users SET name = $1, weight_lbs = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, email, weight_lbs",
      [name, weight_lbs, session.user.id]
    );

    const updated = result.rows[0];
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    );
  }
}
