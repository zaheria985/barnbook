import pool from "@/lib/db";

export interface FarrierRecord {
  id: string;
  horse_id: string;
  visit_date: string;
  next_due_date: string | null;
  provider: string | null;
  service_type: string;
  findings: string | null;
  notes: string | null;
  cost: number | null;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A Farrier Care expense for this horse with no farrier record yet. */
export interface UnlinkedFarrierExpense {
  id: string;
  date: string;
  amount: number;
  vendor: string | null;
  notes: string | null;
}

function dateOnly(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : (v as Date).toISOString().split("T")[0];
}

function serializeDates(row: Record<string, unknown>): FarrierRecord {
  return {
    ...row,
    visit_date: dateOnly(row.visit_date),
    next_due_date: dateOnly(row.next_due_date),
    cost: row.cost != null ? Number(row.cost) : null,
  } as FarrierRecord;
}

export async function getFarrierRecords(horseId: string): Promise<FarrierRecord[]> {
  const res = await pool.query(
    `SELECT id, horse_id, visit_date, next_due_date, provider, service_type, findings, notes, cost, expense_id, created_at, updated_at
     FROM farrier_records
     WHERE horse_id = $1
     ORDER BY visit_date DESC`,
    [horseId]
  );
  return res.rows.map(serializeDates);
}

export async function getFarrierRecord(id: string): Promise<FarrierRecord | null> {
  const res = await pool.query(
    `SELECT id, horse_id, visit_date, next_due_date, provider, service_type, findings, notes, cost, expense_id, created_at, updated_at
     FROM farrier_records
     WHERE id = $1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return serializeDates(res.rows[0]);
}

export async function createFarrierRecord(data: {
  horse_id: string;
  visit_date: string;
  next_due_date?: string | null;
  provider?: string | null;
  service_type?: string | null;
  findings?: string | null;
  notes?: string | null;
  cost?: number | null;
  expense_id?: string | null;
}): Promise<FarrierRecord> {
  const res = await pool.query(
    `INSERT INTO farrier_records (horse_id, visit_date, next_due_date, provider, service_type, findings, notes, cost, expense_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, horse_id, visit_date, next_due_date, provider, service_type, findings, notes, cost, expense_id, created_at, updated_at`,
    [
      data.horse_id,
      data.visit_date,
      data.next_due_date ?? null,
      data.provider ?? null,
      data.service_type ?? "trim",
      data.findings ?? null,
      data.notes ?? null,
      data.cost ?? null,
      data.expense_id ?? null,
    ]
  );
  return serializeDates(res.rows[0]);
}

export async function updateFarrierRecord(
  id: string,
  data: {
    visit_date?: string;
    next_due_date?: string | null;
    provider?: string | null;
    service_type?: string | null;
    findings?: string | null;
    notes?: string | null;
    cost?: number | null;
  }
): Promise<FarrierRecord | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (data.visit_date !== undefined) {
    fields.push(`visit_date = $${idx++}`);
    values.push(data.visit_date);
  }
  if (data.next_due_date !== undefined) {
    fields.push(`next_due_date = $${idx++}`);
    values.push(data.next_due_date);
  }
  if (data.provider !== undefined) {
    fields.push(`provider = $${idx++}`);
    values.push(data.provider);
  }
  if (data.service_type !== undefined) {
    fields.push(`service_type = $${idx++}`);
    values.push(data.service_type);
  }
  if (data.findings !== undefined) {
    fields.push(`findings = $${idx++}`);
    values.push(data.findings);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }
  if (data.cost !== undefined) {
    fields.push(`cost = $${idx++}`);
    values.push(data.cost);
  }

  if (fields.length === 0) return getFarrierRecord(id);

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE farrier_records SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, horse_id, visit_date, next_due_date, provider, service_type, findings, notes, cost, expense_id, created_at, updated_at`,
    values
  );

  if (res.rows.length === 0) return null;
  return serializeDates(res.rows[0]);
}

export async function deleteFarrierRecord(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM farrier_records WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Farrier Care expenses attributable to this horse (via the sub-item's
 * horse_id) that no farrier record links to yet — feeds the "create a record
 * from this expense?" prompt on the horse page.
 */
export async function getUnlinkedFarrierExpenses(
  horseId: string
): Promise<UnlinkedFarrierExpense[]> {
  const res = await pool.query(
    `SELECT e.id, e.date, e.amount, e.vendor, e.notes
     FROM expenses e
     JOIN budget_categories c ON c.id = e.category_id
     JOIN budget_category_sub_items s ON s.id = e.sub_item_id
     WHERE c.name = 'Farrier Care'
       AND s.horse_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM farrier_records fr WHERE fr.expense_id = e.id
       )
     ORDER BY e.date DESC
     LIMIT 10`,
    [horseId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    date: dateOnly(r.date)!,
    amount: Number(r.amount),
    vendor: r.vendor,
    notes: r.notes,
  }));
}
