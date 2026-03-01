import pool from "@/lib/db";

export interface Horse {
  id: string;
  name: string;
  weight_lbs: number | null;
  breed: string | null;
  color: string | null;
  date_of_birth: string | null;
  registration_number: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

// Categories that get a per-horse sub-item automatically
const PER_HORSE_CATEGORIES = [
  "Board",
  "Farrier Care",
  "Veterinary Care",
  "Additional Feed",
  "Clipping",
];

export async function getHorses(): Promise<Horse[]> {
  const res = await pool.query(
    `SELECT id, name, weight_lbs, breed, color, date_of_birth, registration_number, photo_url, created_at, updated_at
     FROM horses
     ORDER BY name`
  );
  return res.rows;
}

export async function getHorse(id: string): Promise<Horse | null> {
  const res = await pool.query(
    `SELECT id, name, weight_lbs, breed, color, date_of_birth, registration_number, photo_url, created_at, updated_at
     FROM horses WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createHorse(data: {
  name: string;
  weight_lbs?: number | null;
  breed?: string | null;
  color?: string | null;
  date_of_birth?: string | null;
  registration_number?: string | null;
}): Promise<Horse> {
  const res = await pool.query(
    `INSERT INTO horses (name, weight_lbs, breed, color, date_of_birth, registration_number)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, weight_lbs, breed, color, date_of_birth, registration_number, photo_url, created_at, updated_at`,
    [
      data.name,
      data.weight_lbs ?? null,
      data.breed ?? null,
      data.color ?? null,
      data.date_of_birth ?? null,
      data.registration_number ?? null,
    ]
  );
  const horse = res.rows[0];

  // Auto-create budget sub-items for per-horse categories
  await syncHorseBudgetSubItems(horse.id, horse.name);

  return horse;
}

export async function updateHorse(
  id: string,
  data: {
    name?: string;
    weight_lbs?: number | null;
    breed?: string | null;
    color?: string | null;
    date_of_birth?: string | null;
    registration_number?: string | null;
    photo_url?: string | null;
  }
): Promise<Horse | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.weight_lbs !== undefined) {
    fields.push(`weight_lbs = $${idx++}`);
    values.push(data.weight_lbs);
  }
  if (data.breed !== undefined) {
    fields.push(`breed = $${idx++}`);
    values.push(data.breed);
  }
  if (data.color !== undefined) {
    fields.push(`color = $${idx++}`);
    values.push(data.color);
  }
  if (data.date_of_birth !== undefined) {
    fields.push(`date_of_birth = $${idx++}`);
    values.push(data.date_of_birth);
  }
  if (data.registration_number !== undefined) {
    fields.push(`registration_number = $${idx++}`);
    values.push(data.registration_number);
  }
  if (data.photo_url !== undefined) {
    fields.push(`photo_url = $${idx++}`);
    values.push(data.photo_url);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE horses SET ${fields.join(", ")} WHERE id = $${idx}
     RETURNING id, name, weight_lbs, breed, color, date_of_birth, registration_number, photo_url, created_at, updated_at`,
    values
  );
  const horse = res.rows[0];
  if (!horse) return null;

  // If name changed, update linked budget sub-item labels
  if (data.name !== undefined) {
    await pool.query(
      `UPDATE budget_category_sub_items SET label = $1 WHERE horse_id = $2`,
      [data.name, id]
    );
  }

  return horse;
}

export async function deleteHorse(id: string): Promise<boolean> {
  // Remove budget sub-items that have no expenses or budgets referencing them
  await pool.query(
    `DELETE FROM budget_category_sub_items
     WHERE horse_id = $1
       AND id NOT IN (SELECT DISTINCT sub_item_id FROM expenses WHERE sub_item_id IS NOT NULL)
       AND id NOT IN (SELECT DISTINCT sub_item_id FROM monthly_budgets WHERE sub_item_id IS NOT NULL)`,
    [id]
  );

  // For sub-items WITH data, just unlink the horse (ON DELETE SET NULL handles this,
  // but we already cleaned up the ones without data above)

  const res = await pool.query(`DELETE FROM horses WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Ensures a sub-item exists under each per-horse category for this horse.
 * Idempotent — safe to call multiple times.
 */
async function syncHorseBudgetSubItems(
  horseId: string,
  horseName: string
): Promise<void> {
  const catRes = await pool.query(
    `SELECT id, name FROM budget_categories
     WHERE name = ANY($1) AND is_system = true`,
    [PER_HORSE_CATEGORIES]
  );

  for (const cat of catRes.rows) {
    // Check if sub-item already exists for this horse+category
    const existing = await pool.query(
      `SELECT id FROM budget_category_sub_items
       WHERE category_id = $1 AND horse_id = $2`,
      [cat.id, horseId]
    );

    if (existing.rows.length === 0) {
      // Get next sort order
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
         FROM budget_category_sub_items WHERE category_id = $1`,
        [cat.id]
      );

      await pool.query(
        `INSERT INTO budget_category_sub_items (category_id, label, horse_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [cat.id, horseName, horseId, maxOrder.rows[0].next_order]
      );
    }
  }
}
