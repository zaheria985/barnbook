import type { FootingRating } from "./queries/footing-feedback";
import { getRecentFeedback } from "./queries/footing-feedback";
import { getSettings, updateSettings } from "./queries/weather-settings";

export type FeedbackClassification = "correct" | "too_conservative" | "too_aggressive";

const MIN_FEEDBACK_COUNT = 5;
const AGREEMENT_THRESHOLD = 0.6;
const ADJUSTMENT_STEP = 5;
const MIN_DRYING_RATE = 20;
const MAX_DRYING_RATE = 120;

export function classifyFeedback(
  predictedScore: string,
  actualFooting: FootingRating
): FeedbackClassification {
  const scoreRank: Record<string, number> = { green: 0, yellow: 1, red: 2 };
  const footingRank: Record<string, number> = { good: 0, soft: 1, unsafe: 2 };

  const predicted = scoreRank[predictedScore] ?? 0;
  const actual = footingRank[actualFooting] ?? 0;

  if (predicted === actual) return "correct";
  if (predicted > actual) return "too_conservative";
  return "too_aggressive";
}

export async function checkAndTuneDryingRate(): Promise<{
  adjusted: boolean;
  old_rate?: number;
  new_rate?: number;
  reason?: string;
}> {
  const settings = await getSettings();
  if (!settings || !settings.auto_tune_drying_rate) {
    return { adjusted: false, reason: "auto-tune disabled" };
  }

  // Don't adjust more than once per day
  if (settings.last_tuned_at) {
    const lastTuned = new Date(settings.last_tuned_at);
    const now = new Date();
    const hoursSinceTune = (now.getTime() - lastTuned.getTime()) / (1000 * 60 * 60);
    if (hoursSinceTune < 24) {
      return { adjusted: false, reason: "already tuned today" };
    }
  }

  const recent = await getRecentFeedback(10);
  const withPredictions = recent.filter((f) => f.predicted_score != null);

  if (withPredictions.length < MIN_FEEDBACK_COUNT) {
    return { adjusted: false, reason: `need ${MIN_FEEDBACK_COUNT} feedbacks, have ${withPredictions.length}` };
  }

  let tooConservative = 0;
  let tooAggressive = 0;

  for (const f of withPredictions) {
    const c = classifyFeedback(f.predicted_score!, f.actual_footing);
    if (c === "too_conservative") tooConservative++;
    else if (c === "too_aggressive") tooAggressive++;
  }

  const total = withPredictions.length;
  const oldRate = settings.footing_dry_hours_per_inch;
  let newRate = oldRate;

  if (tooConservative / total >= AGREEMENT_THRESHOLD) {
    // Predictions too cautious - arena dries faster than modeled
    newRate = Math.max(MIN_DRYING_RATE, oldRate - ADJUSTMENT_STEP);
  } else if (tooAggressive / total >= AGREEMENT_THRESHOLD) {
    // Predictions too optimistic - arena dries slower than modeled
    newRate = Math.min(MAX_DRYING_RATE, oldRate + ADJUSTMENT_STEP);
  }

  if (newRate === oldRate) {
    return { adjusted: false, reason: "no clear trend" };
  }

  await updateSettings({
    footing_dry_hours_per_inch: newRate,
    last_tuned_at: new Date(),
  });

  return { adjusted: true, old_rate: oldRate, new_rate: newRate };
}
