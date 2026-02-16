import pool from "@/lib/db";

export interface VendorMapping {
  id: string;
  vendor_pattern: string;
  category_id: string;
  category_name: string;
  sub_item_id: string | null;
  sub_item_label: string | null;
  created_at: string;
  updated_at: string;
}

export async function getVendorMappings(): Promise<VendorMapping[]> {
  const res = await pool.query(
    `SELECT vm.id, vm.vendor_pattern, vm.category_id, bc.name AS category_name,
            vm.sub_item_id, bcs.label AS sub_item_label,
            vm.created_at, vm.updated_at
     FROM vendor_mappings vm
     JOIN budget_categories bc ON bc.id = vm.category_id
     LEFT JOIN budget_category_sub_items bcs ON bcs.id = vm.sub_item_id
     ORDER BY vm.vendor_pattern`
  );
  return res.rows;
}

export async function createMapping(data: {
  vendor_pattern: string;
  category_id: string;
  sub_item_id?: string | null;
}): Promise<VendorMapping> {
  const res = await pool.query(
    `INSERT INTO vendor_mappings (vendor_pattern, category_id, sub_item_id)
     VALUES ($1, $2, $3)
     RETURNING id, vendor_pattern, category_id, sub_item_id, created_at, updated_at`,
    [data.vendor_pattern, data.category_id, data.sub_item_id ?? null]
  );

  // Fetch with joined names
  const full = await pool.query(
    `SELECT vm.id, vm.vendor_pattern, vm.category_id, bc.name AS category_name,
            vm.sub_item_id, bcs.label AS sub_item_label,
            vm.created_at, vm.updated_at
     FROM vendor_mappings vm
     JOIN budget_categories bc ON bc.id = vm.category_id
     LEFT JOIN budget_category_sub_items bcs ON bcs.id = vm.sub_item_id
     WHERE vm.id = $1`,
    [res.rows[0].id]
  );
  return full.rows[0];
}

export async function updateMapping(
  id: string,
  data: { vendor_pattern?: string; category_id?: string; sub_item_id?: string | null }
): Promise<VendorMapping | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.vendor_pattern !== undefined) {
    fields.push(`vendor_pattern = $${idx++}`);
    values.push(data.vendor_pattern);
  }
  if (data.category_id !== undefined) {
    fields.push(`category_id = $${idx++}`);
    values.push(data.category_id);
  }
  if (data.sub_item_id !== undefined) {
    fields.push(`sub_item_id = $${idx++}`);
    values.push(data.sub_item_id);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = now()`);
  values.push(id);

  await pool.query(
    `UPDATE vendor_mappings SET ${fields.join(", ")} WHERE id = $${idx}`,
    values
  );

  const full = await pool.query(
    `SELECT vm.id, vm.vendor_pattern, vm.category_id, bc.name AS category_name,
            vm.sub_item_id, bcs.label AS sub_item_label,
            vm.created_at, vm.updated_at
     FROM vendor_mappings vm
     JOIN budget_categories bc ON bc.id = vm.category_id
     LEFT JOIN budget_category_sub_items bcs ON bcs.id = vm.sub_item_id
     WHERE vm.id = $1`,
    [id]
  );
  return full.rows[0] || null;
}

export async function deleteMapping(id: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM vendor_mappings WHERE id = $1`,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function matchVendor(
  vendorName: string
): Promise<VendorMapping | null> {
  const res = await pool.query(
    `SELECT vm.id, vm.vendor_pattern, vm.category_id, bc.name AS category_name,
            vm.sub_item_id, bcs.label AS sub_item_label,
            vm.created_at, vm.updated_at
     FROM vendor_mappings vm
     JOIN budget_categories bc ON bc.id = vm.category_id
     LEFT JOIN budget_category_sub_items bcs ON bcs.id = vm.sub_item_id
     WHERE $1 ILIKE '%' || vm.vendor_pattern || '%'
     LIMIT 1`,
    [vendorName]
  );
  return res.rows[0] || null;
}
