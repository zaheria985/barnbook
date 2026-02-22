import pool from "@/lib/db";

export interface EventChecklistItem {
  id: string;
  event_id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
  vikunja_task_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getChecklist(eventId: string): Promise<EventChecklistItem[]> {
  const res = await pool.query(
    `SELECT id, event_id, title, due_date, is_completed, vikunja_task_id,
            sort_order, created_at, updated_at
     FROM event_checklists WHERE event_id = $1
     ORDER BY sort_order`,
    [eventId]
  );
  return res.rows;
}

export async function applyTemplate(
  eventId: string,
  templateId: string
): Promise<EventChecklistItem[]> {
  // Do all date math in SQL to avoid JS Date parsing issues
  const res = await pool.query(
    `INSERT INTO event_checklists (event_id, title, due_date, is_completed, sort_order)
     SELECT $1, cti.title,
            (SELECT e.start_date FROM events e WHERE e.id = $1) - (cti.days_before_event * INTERVAL '1 day'),
            false, cti.sort_order
     FROM checklist_template_items cti
     WHERE cti.template_id = $2
     ORDER BY cti.sort_order
     RETURNING id, event_id, title, due_date, is_completed, vikunja_task_id,
               sort_order, created_at, updated_at`,
    [eventId, templateId]
  );
  return res.rows;
}

export async function toggleChecklistItem(
  id: string
): Promise<EventChecklistItem | null> {
  const res = await pool.query(
    `UPDATE event_checklists SET is_completed = NOT is_completed, updated_at = now()
     WHERE id = $1
     RETURNING id, event_id, title, due_date, is_completed, vikunja_task_id,
               sort_order, created_at, updated_at`,
    [id]
  );
  return res.rows[0] || null;
}

export async function addChecklistItem(data: {
  event_id: string;
  title: string;
  due_date?: string | null;
  sort_order?: number;
}): Promise<EventChecklistItem> {
  const res = await pool.query(
    `INSERT INTO event_checklists (event_id, title, due_date, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_id, title, due_date, is_completed, vikunja_task_id,
               sort_order, created_at, updated_at`,
    [data.event_id, data.title, data.due_date ?? null, data.sort_order ?? 0]
  );
  return res.rows[0];
}

export async function deleteChecklistItem(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM event_checklists WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
