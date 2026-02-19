import pool from "@/lib/db";
import { getSnapshot } from "./weather-snapshots";

export type FootingRating = "good" | "soft" | "unsafe";

export interface FootingFeedback {
  id: string;
  date: string;
  ride_session_id: string | null;
  actual_footing: FootingRating;
  predicted_score: string | null;
  predicted_moisture: number | null;
  drying_rate_at_time: number | null;
  created_at: string;
}

export interface AccuracyStats {
  total: number;
  correct: number;
  too_conservative: number;
  too_aggressive: number;
  accuracy_pct: number | null;
}

export async function createFeedback(data: {
  date: string;
  ride_session_id?: string | null;
  actual_footing: FootingRating;
}): Promise<FootingFeedback> {
  // Look up prediction snapshot for this date
  const snapshot = await getSnapshot(data.date);

  const res = await pool.query(
    `INSERT INTO footing_feedback
       (date, ride_session_id, actual_footing, predicted_score, predicted_moisture, drying_rate_at_time)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (date) DO UPDATE SET
       ride_session_id = COALESCE(EXCLUDED.ride_session_id, footing_feedback.ride_session_id),
       actual_footing = EXCLUDED.actual_footing,
       predicted_score = EXCLUDED.predicted_score,
       predicted_moisture = EXCLUDED.predicted_moisture,
       drying_rate_at_time = EXCLUDED.drying_rate_at_time
     RETURNING *`,
    [
      data.date,
      data.ride_session_id ?? null,
      data.actual_footing,
      snapshot?.score ?? null,
      snapshot?.predicted_moisture ?? null,
      snapshot?.drying_rate_at_time ?? null,
    ]
  );
  return normalizeRow(res.rows[0]);
}

export async function getFeedbackForDate(date: string): Promise<FootingFeedback | null> {
  const res = await pool.query(
    `SELECT * FROM footing_feedback WHERE date = $1`,
    [date]
  );
  return res.rows.length > 0 ? normalizeRow(res.rows[0]) : null;
}

export async function getRecentFeedback(limit = 10): Promise<FootingFeedback[]> {
  const res = await pool.query(
    `SELECT * FROM footing_feedback ORDER BY date DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map(normalizeRow);
}

export async function getAccuracyStats(): Promise<AccuracyStats> {
  const res = await pool.query(
    `SELECT actual_footing, predicted_score FROM footing_feedback
     WHERE predicted_score IS NOT NULL
     ORDER BY date DESC`
  );

  let correct = 0;
  let too_conservative = 0;
  let too_aggressive = 0;

  for (const row of res.rows) {
    const classification = classifyAccuracy(row.predicted_score, row.actual_footing);
    if (classification === "correct") correct++;
    else if (classification === "too_conservative") too_conservative++;
    else too_aggressive++;
  }

  const total = res.rows.length;
  return {
    total,
    correct,
    too_conservative,
    too_aggressive,
    accuracy_pct: total >= 5 ? Math.round((correct / total) * 100) : null,
  };
}

function classifyAccuracy(
  predicted: string,
  actual: FootingRating
): "correct" | "too_conservative" | "too_aggressive" {
  const scoreRank: Record<string, number> = { green: 0, yellow: 1, red: 2 };
  const footingRank: Record<string, number> = { good: 0, soft: 1, unsafe: 2 };

  const predictedRank = scoreRank[predicted] ?? 0;
  const actualRank = footingRank[actual] ?? 0;

  if (predictedRank === actualRank) return "correct";
  if (predictedRank > actualRank) return "too_conservative";
  return "too_aggressive";
}

function normalizeRow(row: Record<string, unknown>): FootingFeedback {
  return {
    id: row.id as string,
    date: row.date instanceof Date
      ? row.date.toISOString().split("T")[0]
      : row.date as string,
    ride_session_id: row.ride_session_id as string | null,
    actual_footing: row.actual_footing as FootingRating,
    predicted_score: row.predicted_score as string | null,
    predicted_moisture: row.predicted_moisture != null ? Number(row.predicted_moisture) : null,
    drying_rate_at_time: row.drying_rate_at_time != null ? Number(row.drying_rate_at_time) : null,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at as string,
  };
}
