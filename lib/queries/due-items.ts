import pool from "@/lib/db";
import { localToday } from "@/lib/dates";

export interface DueItem {
  horse_id: string;
  horse_name: string;
  kind: "vaccine" | "farrier";
  label: string;
  due_date: string;
  days_until: number; // negative when overdue
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T12:00:00Z");
  const b = Date.parse(to + "T12:00:00Z");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function dateOnly(v: unknown): string {
  return typeof v === "string" ? v.split("T")[0] : (v as Date).toISOString().split("T")[0];
}

/**
 * Barn-wide upcoming/overdue care items: the latest next-due per (horse,
 * vaccine) and the latest farrier next-due per horse, within `withinDays`
 * (overdue items always included). Sorted soonest/most-overdue first.
 */
export async function getDueItems(withinDays = 30): Promise<DueItem[]> {
  const today = localToday();

  const [vaccines, farrier] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (v.horse_id, v.vaccine_name)
              v.horse_id, h.name AS horse_name, v.vaccine_name, v.next_due_date
       FROM vaccine_records v
       JOIN horses h ON h.id = v.horse_id
       WHERE v.next_due_date IS NOT NULL
       ORDER BY v.horse_id, v.vaccine_name, v.date_administered DESC`
    ),
    pool.query(
      `SELECT DISTINCT ON (f.horse_id)
              f.horse_id, h.name AS horse_name, f.service_type, f.next_due_date
       FROM farrier_records f
       JOIN horses h ON h.id = f.horse_id
       WHERE f.next_due_date IS NOT NULL
       ORDER BY f.horse_id, f.visit_date DESC`
    ),
  ]);

  const items: DueItem[] = [];

  for (const r of vaccines.rows) {
    const due = dateOnly(r.next_due_date);
    items.push({
      horse_id: r.horse_id,
      horse_name: r.horse_name,
      kind: "vaccine",
      label: r.vaccine_name,
      due_date: due,
      days_until: daysBetween(today, due),
    });
  }

  for (const r of farrier.rows) {
    const due = dateOnly(r.next_due_date);
    items.push({
      horse_id: r.horse_id,
      horse_name: r.horse_name,
      kind: "farrier",
      label: `Farrier (${r.service_type || "trim"})`,
      due_date: due,
      days_until: daysBetween(today, due),
    });
  }

  return items
    .filter((i) => i.days_until <= withinDays)
    .sort((a, b) => a.days_until - b.days_until);
}
