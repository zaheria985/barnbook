import pool from "@/lib/db";

export interface Tag {
  id: string;
  name: string;
  tag_type: string;
  color: string | null;
  default_category_id: string | null;
  default_category_name: string | null;
  default_sub_item_id: string | null;
  default_sub_item_label: string | null;
  created_at: string;
}

export interface EntityTag {
  id: string;
  tag_id: string;
  tag_name: string;
  tag_type: string;
  color: string | null;
  entity_type: string;
  entity_id: string;
}

const TAG_SELECT = `
  t.id, t.name, t.tag_type, t.color,
  t.default_category_id, bc.name AS default_category_name,
  t.default_sub_item_id, bsi.label AS default_sub_item_label,
  t.created_at
`;

const TAG_JOINS = `
  LEFT JOIN budget_categories bc ON bc.id = t.default_category_id
  LEFT JOIN budget_category_sub_items bsi ON bsi.id = t.default_sub_item_id
`;

export async function getTags(tagType?: string): Promise<Tag[]> {
  const whereClause = tagType ? `WHERE t.tag_type = $1` : "";
  const params = tagType ? [tagType] : [];
  const res = await pool.query(
    `SELECT ${TAG_SELECT}
     FROM tags t
     ${TAG_JOINS}
     ${whereClause}
     ORDER BY t.tag_type, t.name`,
    params
  );
  return res.rows;
}

export async function createTag(data: {
  name: string;
  tagType: string;
  color?: string | null;
  defaultCategoryId?: string | null;
  defaultSubItemId?: string | null;
}): Promise<Tag> {
  const res = await pool.query(
    `INSERT INTO tags (name, tag_type, color, default_category_id, default_sub_item_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.name, data.tagType, data.color || null, data.defaultCategoryId || null, data.defaultSubItemId || null]
  );

  const full = await pool.query(
    `SELECT ${TAG_SELECT} FROM tags t ${TAG_JOINS} WHERE t.id = $1`,
    [res.rows[0].id]
  );
  return full.rows[0];
}

export async function updateTag(
  id: string,
  data: {
    name?: string;
    color?: string | null;
    defaultCategoryId?: string | null;
    defaultSubItemId?: string | null;
  }
): Promise<Tag | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.color !== undefined) {
    fields.push(`color = $${idx++}`);
    values.push(data.color);
  }
  if (data.defaultCategoryId !== undefined) {
    fields.push(`default_category_id = $${idx++}`);
    values.push(data.defaultCategoryId);
  }
  if (data.defaultSubItemId !== undefined) {
    fields.push(`default_sub_item_id = $${idx++}`);
    values.push(data.defaultSubItemId);
  }

  if (fields.length === 0) return null;

  values.push(id);
  await pool.query(
    `UPDATE tags SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );

  const full = await pool.query(
    `SELECT ${TAG_SELECT} FROM tags t ${TAG_JOINS} WHERE t.id = $1`,
    [id]
  );
  return full.rows[0] || null;
}

export async function deleteTag(id: string): Promise<boolean> {
  const res = await pool.query(`DELETE FROM tags WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getEntityTags(
  entityType: string,
  entityId: string
): Promise<EntityTag[]> {
  const res = await pool.query(
    `SELECT et.id, et.tag_id, t.name AS tag_name, t.tag_type, t.color,
            et.entity_type, et.entity_id
     FROM entity_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entity_type = $1 AND et.entity_id = $2
     ORDER BY t.name`,
    [entityType, entityId]
  );
  return res.rows;
}

export async function setEntityTags(
  entityType: string,
  entityId: string,
  tagIds: string[]
): Promise<void> {
  await pool.query(
    `DELETE FROM entity_tags WHERE entity_type = $1 AND entity_id = $2`,
    [entityType, entityId]
  );

  if (tagIds.length > 0) {
    const values = tagIds.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ");
    const params = tagIds.flatMap((tagId) => [tagId, entityType, entityId]);
    await pool.query(
      `INSERT INTO entity_tags (tag_id, entity_type, entity_id) VALUES ${values}
       ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING`,
      params
    );
  }
}

export async function addEntityTag(
  entityType: string,
  entityId: string,
  tagId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO entity_tags (tag_id, entity_type, entity_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING`,
    [tagId, entityType, entityId]
  );
}

export async function removeEntityTag(
  entityType: string,
  entityId: string,
  tagId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM entity_tags
     WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [tagId, entityType, entityId]
  );
}

export async function matchVendorTag(
  name: string
): Promise<Tag | null> {
  // Exact match first
  const exact = await pool.query(
    `SELECT ${TAG_SELECT} FROM tags t ${TAG_JOINS}
     WHERE t.tag_type = 'vendor' AND LOWER(t.name) = LOWER($1)
     LIMIT 1`,
    [name]
  );
  if (exact.rows.length > 0) return exact.rows[0];

  // Fuzzy: name contains tag or tag contains name (case-insensitive)
  const fuzzy = await pool.query(
    `SELECT ${TAG_SELECT} FROM tags t ${TAG_JOINS}
     WHERE t.tag_type = 'vendor'
       AND ($1 ILIKE '%' || t.name || '%' OR t.name ILIKE '%' || $1 || '%')
     ORDER BY LENGTH(t.name) DESC
     LIMIT 1`,
    [name]
  );
  return fuzzy.rows[0] || null;
}
