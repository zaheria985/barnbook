import pool from "@/lib/db";

export interface FailedIngest {
  id: string;
  subject: string | null;
  reason: string;
  raw_payload: unknown;
  resolved: boolean;
  created_at: string;
}

/** Persist an email receipt that could not be turned into an expense, so it is
 *  reviewable instead of vanishing with only a console error. */
export async function recordFailedIngest(data: {
  subject?: string | null;
  reason: string;
  raw_payload?: unknown;
}): Promise<void> {
  await pool.query(
    `INSERT INTO failed_ingests (subject, reason, raw_payload)
     VALUES ($1, $2, $3)`,
    [data.subject ?? null, data.reason, data.raw_payload != null ? JSON.stringify(data.raw_payload) : null]
  );
}

export async function getUnresolvedIngestCount(): Promise<number> {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count FROM failed_ingests WHERE resolved = false`
  );
  return res.rows[0]?.count ?? 0;
}

export async function listFailedIngests(includeResolved = false): Promise<FailedIngest[]> {
  const res = await pool.query(
    `SELECT id, subject, reason, raw_payload, resolved, created_at
     FROM failed_ingests
     ${includeResolved ? "" : "WHERE resolved = false"}
     ORDER BY created_at DESC
     LIMIT 100`
  );
  return res.rows;
}

export async function resolveFailedIngest(id: string): Promise<void> {
  await pool.query(`UPDATE failed_ingests SET resolved = true WHERE id = $1`, [id]);
}
