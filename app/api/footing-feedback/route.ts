import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createFeedback, getFeedbackForDate } from "@/lib/queries/footing-feedback";
import { checkAndTuneDryingRate } from "@/lib/footing-tuner";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date parameter required" }, { status: 400 });
  }

  try {
    const feedback = await getFeedbackForDate(date);
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Failed to fetch footing feedback:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, ride_session_id, actual_footing } = body;

    if (!date || !actual_footing) {
      return NextResponse.json(
        { error: "date and actual_footing are required" },
        { status: 400 }
      );
    }

    if (!["good", "soft", "unsafe"].includes(actual_footing)) {
      return NextResponse.json(
        { error: "actual_footing must be good, soft, or unsafe" },
        { status: 400 }
      );
    }

    const feedback = await createFeedback({
      date,
      ride_session_id: ride_session_id || null,
      actual_footing,
    });

    // Fire-and-forget auto-tune check
    checkAndTuneDryingRate().catch((err) => {
      console.error("Auto-tune check failed:", err);
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error("Failed to save footing feedback:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
