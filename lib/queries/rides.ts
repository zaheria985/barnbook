import pool from "@/lib/db";

export interface RideSession {
  id: string;
  rider_id: string;
  rider_name: string;
  horse_id: string;
  horse_name: string;
  date: string;
  total_duration_minutes: number;
  walk_minutes: number;
  trot_minutes: number;
  canter_minutes: number;
  distance_miles: number | null;
  rider_calories_burned: number | null;
  horse_mcal_expended: number | null;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface CreateRideData {
  rider_id: string;
  horse_id: string;
  date: string;
  total_duration_minutes: number;
  walk_minutes: number;
  trot_minutes: number;
  canter_minutes: number;
  distance_miles?: number | null;
  notes?: string | null;
  source?: string;
}

export interface UpdateRideData {
  horse_id?: string;
  date?: string;
  total_duration_minutes?: number;
  walk_minutes?: number;
  trot_minutes?: number;
  canter_minutes?: number;
  distance_miles?: number | null;
  notes?: string | null;
}

// Calorie/Mcal calculation constants
const RIDER_GAIT_RATES = { walk: 3.5, trot: 5.5, canter: 8.0 };
const HORSE_GAIT_RATES = { walk: 1.5, trot: 4.5, canter: 9.0 };
const RIDER_WEIGHT_BASELINE = 150;
const HORSE_WEIGHT_BASELINE = 1100;

export function calculateRiderCalories(
  walkMin: number,
  trotMin: number,
  canterMin: number,
  riderWeightLbs: number
): number {
  const factor = riderWeightLbs / RIDER_WEIGHT_BASELINE;
  return Math.round(
    walkMin * RIDER_GAIT_RATES.walk * factor +
      trotMin * RIDER_GAIT_RATES.trot * factor +
      canterMin * RIDER_GAIT_RATES.canter * factor
  );
}

export function calculateHorseMcal(
  walkMin: number,
  trotMin: number,
  canterMin: number,
  horseWeightLbs: number
): number {
  const factor = horseWeightLbs / HORSE_WEIGHT_BASELINE;
  const mcal =
    (walkMin / 60) * HORSE_GAIT_RATES.walk * factor +
    (trotMin / 60) * HORSE_GAIT_RATES.trot * factor +
    (canterMin / 60) * HORSE_GAIT_RATES.canter * factor;
  return Math.round(mcal * 100) / 100;
}

const RIDE_SELECT = `
  SELECT rs.id, rs.rider_id, u.name AS rider_name,
         rs.horse_id, h.name AS horse_name,
         rs.date, rs.total_duration_minutes,
         rs.walk_minutes, rs.trot_minutes, rs.canter_minutes,
         rs.distance_miles, rs.rider_calories_burned, rs.horse_mcal_expended,
         rs.notes, rs.source, rs.created_at
  FROM ride_sessions rs
  JOIN users u ON u.id = rs.rider_id
  JOIN horses h ON h.id = rs.horse_id`;

export async function getRides(filters: {
  month?: string;
  rider_id?: string;
  horse_id?: string;
}): Promise<RideSession[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;

  if (filters.month) {
    conditions.push(`TO_CHAR(rs.date, 'YYYY-MM') = $${idx++}`);
    params.push(filters.month);
  }
  if (filters.rider_id) {
    conditions.push(`rs.rider_id = $${idx++}`);
    params.push(filters.rider_id);
  }
  if (filters.horse_id) {
    conditions.push(`rs.horse_id = $${idx++}`);
    params.push(filters.horse_id);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `${RIDE_SELECT}${where} ORDER BY rs.date DESC, rs.created_at DESC`,
    params
  );
  return res.rows;
}

export async function createRide(data: CreateRideData): Promise<RideSession> {
  // Fetch rider weight and horse weight for calorie/Mcal calc
  const [userRes, horseRes] = await Promise.all([
    pool.query(`SELECT weight_lbs FROM users WHERE id = $1`, [data.rider_id]),
    pool.query(`SELECT weight_lbs FROM horses WHERE id = $1`, [data.horse_id]),
  ]);

  const riderWeight = userRes.rows[0]?.weight_lbs || RIDER_WEIGHT_BASELINE;
  const horseWeight = horseRes.rows[0]?.weight_lbs || HORSE_WEIGHT_BASELINE;

  const calories = calculateRiderCalories(
    data.walk_minutes,
    data.trot_minutes,
    data.canter_minutes,
    riderWeight
  );
  const mcal = calculateHorseMcal(
    data.walk_minutes,
    data.trot_minutes,
    data.canter_minutes,
    horseWeight
  );

  const res = await pool.query(
    `INSERT INTO ride_sessions
       (rider_id, horse_id, date, total_duration_minutes,
        walk_minutes, trot_minutes, canter_minutes,
        distance_miles, rider_calories_burned, horse_mcal_expended, notes, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      data.rider_id,
      data.horse_id,
      data.date,
      data.total_duration_minutes,
      data.walk_minutes,
      data.trot_minutes,
      data.canter_minutes,
      data.distance_miles ?? null,
      calories,
      mcal,
      data.notes ?? null,
      data.source ?? "manual",
    ]
  );

  const ride = await pool.query(`${RIDE_SELECT} WHERE rs.id = $1`, [
    res.rows[0].id,
  ]);
  return ride.rows[0];
}

export async function updateRide(
  id: string,
  data: UpdateRideData
): Promise<RideSession | null> {
  // If gait minutes changed, recalculate calories/mcal
  const needsRecalc =
    data.walk_minutes !== undefined ||
    data.trot_minutes !== undefined ||
    data.canter_minutes !== undefined ||
    data.horse_id !== undefined;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (data.horse_id !== undefined) {
    fields.push(`horse_id = $${idx++}`);
    values.push(data.horse_id);
  }
  if (data.date !== undefined) {
    fields.push(`date = $${idx++}`);
    values.push(data.date);
  }
  if (data.total_duration_minutes !== undefined) {
    fields.push(`total_duration_minutes = $${idx++}`);
    values.push(data.total_duration_minutes);
  }
  if (data.walk_minutes !== undefined) {
    fields.push(`walk_minutes = $${idx++}`);
    values.push(data.walk_minutes);
  }
  if (data.trot_minutes !== undefined) {
    fields.push(`trot_minutes = $${idx++}`);
    values.push(data.trot_minutes);
  }
  if (data.canter_minutes !== undefined) {
    fields.push(`canter_minutes = $${idx++}`);
    values.push(data.canter_minutes);
  }
  if (data.distance_miles !== undefined) {
    fields.push(`distance_miles = $${idx++}`);
    values.push(data.distance_miles);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }

  if (fields.length === 0) return null;

  if (needsRecalc) {
    // Get current ride data merged with updates
    const current = await pool.query(
      `SELECT rs.rider_id, rs.horse_id, rs.walk_minutes, rs.trot_minutes, rs.canter_minutes
       FROM ride_sessions rs WHERE rs.id = $1`,
      [id]
    );
    if (!current.rows[0]) return null;

    const merged = {
      horse_id: data.horse_id ?? current.rows[0].horse_id,
      walk_minutes: data.walk_minutes ?? current.rows[0].walk_minutes,
      trot_minutes: data.trot_minutes ?? current.rows[0].trot_minutes,
      canter_minutes: data.canter_minutes ?? current.rows[0].canter_minutes,
    };

    const [userRes, horseRes] = await Promise.all([
      pool.query(`SELECT weight_lbs FROM users WHERE id = $1`, [
        current.rows[0].rider_id,
      ]),
      pool.query(`SELECT weight_lbs FROM horses WHERE id = $1`, [
        merged.horse_id,
      ]),
    ]);

    const riderWeight = userRes.rows[0]?.weight_lbs || RIDER_WEIGHT_BASELINE;
    const horseWeight = horseRes.rows[0]?.weight_lbs || HORSE_WEIGHT_BASELINE;

    fields.push(`rider_calories_burned = $${idx++}`);
    values.push(
      calculateRiderCalories(
        merged.walk_minutes,
        merged.trot_minutes,
        merged.canter_minutes,
        riderWeight
      )
    );
    fields.push(`horse_mcal_expended = $${idx++}`);
    values.push(
      calculateHorseMcal(
        merged.walk_minutes,
        merged.trot_minutes,
        merged.canter_minutes,
        horseWeight
      )
    );
  }

  fields.push(`updated_at = now()`);
  values.push(id);

  await pool.query(
    `UPDATE ride_sessions SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );

  const ride = await pool.query(`${RIDE_SELECT} WHERE rs.id = $1`, [id]);
  return ride.rows[0] || null;
}

export async function deleteRide(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM ride_sessions WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export interface RideStats {
  total_rides: number;
  total_duration_minutes: number;
  total_walk_minutes: number;
  total_trot_minutes: number;
  total_canter_minutes: number;
  total_calories: number;
  total_mcal: number;
  total_distance_miles: number;
  rides_by_horse: {
    horse_id: string;
    horse_name: string;
    ride_count: number;
    total_minutes: number;
    total_calories: number;
  }[];
  rides_by_date: {
    date: string;
    ride_count: number;
    total_calories: number;
    total_minutes: number;
  }[];
}

export async function getRideStats(filters: {
  period: "week" | "month";
  date?: string;
  rider_id?: string;
}): Promise<RideStats> {
  const refDate = filters.date || new Date().toISOString().split("T")[0];
  let dateCondition: string;
  const params: (string | undefined)[] = [];
  let idx = 1;

  if (filters.period === "week") {
    dateCondition = `rs.date >= ($${idx++})::date - INTERVAL '6 days' AND rs.date <= ($${idx++})::date`;
    params.push(refDate, refDate);
  } else {
    dateCondition = `TO_CHAR(rs.date, 'YYYY-MM') = SUBSTRING($${idx++} FROM 1 FOR 7)`;
    params.push(refDate);
  }

  const riderCondition = filters.rider_id
    ? ` AND rs.rider_id = $${idx++}`
    : "";
  if (filters.rider_id) params.push(filters.rider_id);

  const where = `WHERE ${dateCondition}${riderCondition}`;

  const [totalsRes, byHorseRes, byDateRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total_rides,
         COALESCE(SUM(total_duration_minutes), 0)::int AS total_duration_minutes,
         COALESCE(SUM(walk_minutes), 0)::int AS total_walk_minutes,
         COALESCE(SUM(trot_minutes), 0)::int AS total_trot_minutes,
         COALESCE(SUM(canter_minutes), 0)::int AS total_canter_minutes,
         COALESCE(SUM(rider_calories_burned), 0)::int AS total_calories,
         COALESCE(SUM(horse_mcal_expended), 0)::numeric AS total_mcal,
         COALESCE(SUM(distance_miles), 0)::numeric AS total_distance_miles
       FROM ride_sessions rs ${where}`,
      params
    ),
    pool.query(
      `SELECT h.id AS horse_id, h.name AS horse_name,
              COUNT(*)::int AS ride_count,
              COALESCE(SUM(rs.total_duration_minutes), 0)::int AS total_minutes,
              COALESCE(SUM(rs.rider_calories_burned), 0)::int AS total_calories
       FROM ride_sessions rs
       JOIN horses h ON h.id = rs.horse_id
       ${where}
       GROUP BY h.id, h.name
       ORDER BY ride_count DESC`,
      params
    ),
    pool.query(
      `SELECT rs.date::text,
              COUNT(*)::int AS ride_count,
              COALESCE(SUM(rs.rider_calories_burned), 0)::int AS total_calories,
              COALESCE(SUM(rs.total_duration_minutes), 0)::int AS total_minutes
       FROM ride_sessions rs
       ${where}
       GROUP BY rs.date
       ORDER BY rs.date`,
      params
    ),
  ]);

  const totals = totalsRes.rows[0];

  return {
    total_rides: totals.total_rides,
    total_duration_minutes: totals.total_duration_minutes,
    total_walk_minutes: totals.total_walk_minutes,
    total_trot_minutes: totals.total_trot_minutes,
    total_canter_minutes: totals.total_canter_minutes,
    total_calories: totals.total_calories,
    total_mcal: Number(totals.total_mcal),
    total_distance_miles: Number(totals.total_distance_miles),
    rides_by_horse: byHorseRes.rows,
    rides_by_date: byDateRes.rows,
  };
}
