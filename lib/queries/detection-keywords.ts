import pool from "@/lib/db";

export interface DetectionKeyword {
  id: string;
  keyword: string;
  suggested_event_type: string;
  created_at: string;
}

export async function getKeywords(): Promise<DetectionKeyword[]> {
  const res = await pool.query(
    `SELECT id, keyword, suggested_event_type, created_at
     FROM detection_keywords
     ORDER BY keyword`
  );
  return res.rows;
}

export async function createKeyword(data: {
  keyword: string;
  suggested_event_type: string;
}): Promise<DetectionKeyword> {
  const res = await pool.query(
    `INSERT INTO detection_keywords (keyword, suggested_event_type)
     VALUES ($1, $2)
     RETURNING id, keyword, suggested_event_type, created_at`,
    [data.keyword, data.suggested_event_type]
  );
  return res.rows[0];
}

export async function deleteKeyword(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM detection_keywords WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
