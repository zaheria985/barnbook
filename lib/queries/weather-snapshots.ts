import pool from "@/lib/db";
import type { ScoredDay, MoistureEstimate } from "@/lib/weather-rules";

export interface WeatherSnapshot {
  date: string;
  score: string;
  reasons: string[];
  predicted_moisture: number | null;
  predicted_hours_to_dry: number | null;
  forecast_day_f: number | null;
  forecast_high_f: number | null;
  forecast_rain_inches: number | null;
  forecast_clouds_pct: number | null;
  forecast_wind_mph: number | null;
  drying_rate_at_time: number;
}

export async function upsertSnapshot(
  scoredDay: ScoredDay,
  moisture: MoistureEstimate | null,
  dryingRate: number
): Promise<void> {
  await pool.query(
    `INSERT INTO weather_prediction_snapshots
       (date, score, reasons, predicted_moisture, predicted_hours_to_dry,
        forecast_day_f, forecast_high_f, forecast_rain_inches, forecast_clouds_pct, forecast_wind_mph,
        drying_rate_at_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (date) DO UPDATE SET
       score = EXCLUDED.score,
       reasons = EXCLUDED.reasons,
       predicted_moisture = EXCLUDED.predicted_moisture,
       predicted_hours_to_dry = EXCLUDED.predicted_hours_to_dry,
       forecast_day_f = EXCLUDED.forecast_day_f,
       forecast_high_f = EXCLUDED.forecast_high_f,
       forecast_rain_inches = EXCLUDED.forecast_rain_inches,
       forecast_clouds_pct = EXCLUDED.forecast_clouds_pct,
       forecast_wind_mph = EXCLUDED.forecast_wind_mph,
       drying_rate_at_time = EXCLUDED.drying_rate_at_time,
       created_at = now()`,
    [
      scoredDay.date,
      scoredDay.score,
      scoredDay.reasons,
      moisture?.current_moisture ?? null,
      moisture?.hours_to_dry ?? null,
      scoredDay.forecast.day_f,
      scoredDay.forecast.high_f,
      scoredDay.forecast.precipitation_inches,
      scoredDay.forecast.clouds_pct,
      scoredDay.forecast.wind_speed_mph,
      dryingRate,
    ]
  );
}

export async function getSnapshot(date: string): Promise<WeatherSnapshot | null> {
  const res = await pool.query(
    `SELECT date, score, reasons, predicted_moisture, predicted_hours_to_dry,
            forecast_day_f, forecast_high_f, forecast_rain_inches, forecast_clouds_pct,
            forecast_wind_mph, drying_rate_at_time
     FROM weather_prediction_snapshots
     WHERE date = $1`,
    [date]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    date: typeof row.date === "string" ? row.date : row.date.toISOString().split("T")[0],
  };
}

export async function pruneSnapshots(retentionDays = 90): Promise<number> {
  const res = await pool.query(
    `DELETE FROM weather_prediction_snapshots
     WHERE date < CURRENT_DATE - $1::integer`,
    [retentionDays]
  );
  return res.rowCount ?? 0;
}
