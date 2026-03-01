import pool from "@/lib/db";

export interface EventAttachment {
  id: string;
  event_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export async function getAttachmentsForEvent(eventId: string): Promise<EventAttachment[]> {
  const res = await pool.query(
    `SELECT id, event_id, filename, original_name, mime_type, size_bytes, created_at
     FROM event_attachments WHERE event_id = $1
     ORDER BY created_at`,
    [eventId]
  );
  return res.rows;
}

export async function createAttachment(data: {
  event_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<EventAttachment> {
  const res = await pool.query(
    `INSERT INTO event_attachments (event_id, filename, original_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_id, filename, original_name, mime_type, size_bytes, created_at`,
    [data.event_id, data.filename, data.original_name, data.mime_type, data.size_bytes]
  );
  return res.rows[0];
}

export async function deleteAttachment(id: string): Promise<string | null> {
  const res = await pool.query(
    `DELETE FROM event_attachments WHERE id = $1 RETURNING filename`,
    [id]
  );
  return res.rows[0]?.filename ?? null;
}
