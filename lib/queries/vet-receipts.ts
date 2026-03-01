import pool from "@/lib/db";

export interface VetReceipt {
  id: string;
  vet_record_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export async function getReceiptsForRecord(
  vetRecordId: string
): Promise<VetReceipt[]> {
  const res = await pool.query(
    `SELECT id, vet_record_id, filename, original_name, mime_type, size_bytes, created_at
     FROM vet_receipts
     WHERE vet_record_id = $1
     ORDER BY created_at ASC`,
    [vetRecordId]
  );
  return res.rows;
}

export async function createReceipt(data: {
  vet_record_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<VetReceipt> {
  const res = await pool.query(
    `INSERT INTO vet_receipts (vet_record_id, filename, original_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, vet_record_id, filename, original_name, mime_type, size_bytes, created_at`,
    [
      data.vet_record_id,
      data.filename,
      data.original_name,
      data.mime_type,
      data.size_bytes,
    ]
  );
  return res.rows[0];
}

export async function deleteReceipt(
  id: string
): Promise<{ filename: string } | null> {
  const res = await pool.query(
    `DELETE FROM vet_receipts WHERE id = $1 RETURNING filename`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return { filename: res.rows[0].filename };
}
