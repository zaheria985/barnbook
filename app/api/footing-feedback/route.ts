import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createFeedback, getFeedbackForDate } from "@/lib/queries/footing-feedback";
import { getSettings } from "@/lib/queries/weather-settings";
import { getSnapshot } from "@/lib/queries/weather-snapshots";
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
    const [feedback, settings, snapshot] = await Promise.all([
      getFeedbackForDate(date),
      getSettings(),
      getSnapshot(date),
    ]);
    // Predictions made before the last location move belong to the old arena;
    // don't prompt for feedback on them (they'd train the model for the wrong site).
    const eraStart = settings?.location_changed_at
      ? String(settings.location_changed_at).split("T")[0]
      : null;
    const beforeEra = eraStart !== null && date < eraStart;
    // The prediction we recorded for this date (green/yellow/red), used to show
    // "we predicted X — how was it?" without depending on the live forecast.
    return NextResponse.json({ feedback, beforeEra, predictedScore: snapshot?.score ?? null });
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
