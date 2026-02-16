import pool from "@/lib/db";

export interface ChecklistTemplate {
  id: string;
  name: string;
  event_type: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  title: string;
  days_before_event: number;
  sort_order: number;
}

export interface TemplateReminder {
  id: string;
  template_id: string;
  days_before: number;
}

export interface TemplateWithItems extends ChecklistTemplate {
  items: TemplateItem[];
  reminders: TemplateReminder[];
}

export async function getTemplates(): Promise<ChecklistTemplate[]> {
  const res = await pool.query(
    `SELECT id, name, event_type, created_at, updated_at
     FROM checklist_templates
     ORDER BY name`
  );
  return res.rows;
}

export async function getTemplate(id: string): Promise<TemplateWithItems | null> {
  const templateRes = await pool.query(
    `SELECT id, name, event_type, created_at, updated_at
     FROM checklist_templates WHERE id = $1`,
    [id]
  );
  if (!templateRes.rows[0]) return null;

  const [itemsRes, remindersRes] = await Promise.all([
    pool.query(
      `SELECT id, template_id, title, days_before_event, sort_order
       FROM checklist_template_items WHERE template_id = $1
       ORDER BY sort_order`,
      [id]
    ),
    pool.query(
      `SELECT id, template_id, days_before
       FROM checklist_template_reminders WHERE template_id = $1
       ORDER BY days_before DESC`,
      [id]
    ),
  ]);

  return {
    ...templateRes.rows[0],
    items: itemsRes.rows,
    reminders: remindersRes.rows,
  };
}

export async function createTemplate(data: {
  name: string;
  event_type: string;
}): Promise<ChecklistTemplate> {
  const res = await pool.query(
    `INSERT INTO checklist_templates (name, event_type)
     VALUES ($1, $2)
     RETURNING id, name, event_type, created_at, updated_at`,
    [data.name, data.event_type]
  );
  return res.rows[0];
}

export async function updateTemplate(
  id: string,
  data: { name?: string; event_type?: string }
): Promise<ChecklistTemplate | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.event_type !== undefined) {
    fields.push(`event_type = $${idx++}`);
    values.push(data.event_type);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE checklist_templates SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, name, event_type, created_at, updated_at`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM checklist_templates WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function addTemplateItem(data: {
  template_id: string;
  title: string;
  days_before_event: number;
  sort_order: number;
}): Promise<TemplateItem> {
  const res = await pool.query(
    `INSERT INTO checklist_template_items (template_id, title, days_before_event, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, template_id, title, days_before_event, sort_order`,
    [data.template_id, data.title, data.days_before_event, data.sort_order]
  );
  return res.rows[0];
}

export async function updateTemplateItem(
  id: string,
  data: { title?: string; days_before_event?: number; sort_order?: number }
): Promise<TemplateItem | null> {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(data.title);
  }
  if (data.days_before_event !== undefined) {
    fields.push(`days_before_event = $${idx++}`);
    values.push(data.days_before_event);
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`);
    values.push(data.sort_order);
  }

  if (fields.length === 0) return null;
  values.push(id);

  const res = await pool.query(
    `UPDATE checklist_template_items SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, template_id, title, days_before_event, sort_order`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteTemplateItem(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM checklist_template_items WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function addTemplateReminder(data: {
  template_id: string;
  days_before: number;
}): Promise<TemplateReminder> {
  const res = await pool.query(
    `INSERT INTO checklist_template_reminders (template_id, days_before)
     VALUES ($1, $2)
     RETURNING id, template_id, days_before`,
    [data.template_id, data.days_before]
  );
  return res.rows[0];
}

export async function deleteTemplateReminder(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM checklist_template_reminders WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}
