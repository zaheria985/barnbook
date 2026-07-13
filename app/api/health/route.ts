import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Unauthenticated liveness+readiness probe. Verifies the app can actually reach
// PostgreSQL, so the container isn't reported healthy while every real request
// 500s. Excluded from auth middleware.
export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", db: false }, { status: 503 });
  }
}
