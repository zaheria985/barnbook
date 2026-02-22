import pool from "@/lib/db";

export interface VikunjaProjectMapping {
  id: string;
  category: string;
  project_id: number;
  updated_at: string;
}

export async function getProjectMap(): Promise<VikunjaProjectMapping[]> {
  const res = await pool.query(
    `SELECT id, category, project_id, updated_at
     FROM vikunja_project_map
     ORDER BY category`
  );
  return res.rows;
}

export async function getProjectId(category: string): Promise<number> {
  const res = await pool.query(
    `SELECT project_id
     FROM vikunja_project_map
     WHERE category = $1`,
    [category]
  );
  if (res.rows[0]) {
    return res.rows[0].project_id;
  }
  throw new Error(
    `No Vikunja project mapped for "${category}". Configure in Settings > Integrations.`
  );
}

export async function upsertProjectMapping(
  category: string,
  projectId: number
): Promise<VikunjaProjectMapping> {
  const res = await pool.query(
    `INSERT INTO vikunja_project_map (category, project_id)
     VALUES ($1, $2)
     ON CONFLICT (category) DO UPDATE SET
       project_id = $2,
       updated_at = now()
     RETURNING id, category, project_id, updated_at`,
    [category, projectId]
  );
  return res.rows[0];
}
