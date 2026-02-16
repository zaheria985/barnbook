import pool from "@/lib/db";

export interface WeatherSettings {
  id: string;
  location_lat: number | null;
  location_lng: number | null;
  rain_cutoff_inches: number;
  rain_window_hours: number;
  cold_alert_temp_f: number;
  heat_alert_temp_f: number;
  wind_cutoff_mph: number;
  has_indoor_arena: boolean;
  updated_at: string;
}

export async function getSettings(): Promise<WeatherSettings | null> {
  const res = await pool.query(
    `SELECT id, location_lat, location_lng, rain_cutoff_inches, rain_window_hours,
            cold_alert_temp_f, heat_alert_temp_f, wind_cutoff_mph,
            has_indoor_arena, updated_at
     FROM weather_settings
     LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function updateSettings(data: {
  location_lat?: number | null;
  location_lng?: number | null;
  rain_cutoff_inches?: number;
  rain_window_hours?: number;
  cold_alert_temp_f?: number;
  heat_alert_temp_f?: number;
  wind_cutoff_mph?: number;
  has_indoor_arena?: boolean;
}): Promise<WeatherSettings> {
  const fields: string[] = [];
  const values: (number | boolean | null)[] = [];
  let idx = 1;

  if (data.location_lat !== undefined) {
    fields.push(`location_lat = $${idx++}`);
    values.push(data.location_lat);
  }
  if (data.location_lng !== undefined) {
    fields.push(`location_lng = $${idx++}`);
    values.push(data.location_lng);
  }
  if (data.rain_cutoff_inches !== undefined) {
    fields.push(`rain_cutoff_inches = $${idx++}`);
    values.push(data.rain_cutoff_inches);
  }
  if (data.rain_window_hours !== undefined) {
    fields.push(`rain_window_hours = $${idx++}`);
    values.push(data.rain_window_hours);
  }
  if (data.cold_alert_temp_f !== undefined) {
    fields.push(`cold_alert_temp_f = $${idx++}`);
    values.push(data.cold_alert_temp_f);
  }
  if (data.heat_alert_temp_f !== undefined) {
    fields.push(`heat_alert_temp_f = $${idx++}`);
    values.push(data.heat_alert_temp_f);
  }
  if (data.wind_cutoff_mph !== undefined) {
    fields.push(`wind_cutoff_mph = $${idx++}`);
    values.push(data.wind_cutoff_mph);
  }
  if (data.has_indoor_arena !== undefined) {
    fields.push(`has_indoor_arena = $${idx++}`);
    values.push(data.has_indoor_arena);
  }

  if (fields.length === 0) {
    const existing = await getSettings();
    return existing!;
  }

  fields.push(`updated_at = now()`);

  const res = await pool.query(
    `UPDATE weather_settings SET ${fields.join(", ")}
     WHERE id = (SELECT id FROM weather_settings LIMIT 1)
     RETURNING id, location_lat, location_lng, rain_cutoff_inches, rain_window_hours,
               cold_alert_temp_f, heat_alert_temp_f, wind_cutoff_mph,
               has_indoor_arena, updated_at`,
    values
  );
  return res.rows[0];
}
