// Local-timezone date helpers.
//
// The app is single-barn and its users are all in one timezone. Using UTC for
// "today" (new Date().toISOString().split("T")[0]) rolls the date forward in
// US evenings, which mis-dates expenses/rides and shifts calendar highlights —
// the documented PG DATE gotcha. These helpers resolve the local calendar date
// in the barn's timezone instead.
//
// Server-side reads BARN_TZ (falls back to America/Chicago). Client bundles
// don't see BARN_TZ (it isn't NEXT_PUBLIC_), so they use the same default,
// keeping server and client on the same calendar day.

export const BARN_TZ = process.env.BARN_TZ || "America/Chicago";

/** Today's date as YYYY-MM-DD in the barn's local timezone. */
export function localToday(tz: string = BARN_TZ): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current year-month as YYYY-MM in the barn's local timezone. */
export function localYearMonth(tz: string = BARN_TZ): string {
  return localToday(tz).slice(0, 7);
}

/** Shift a YYYY-MM-DD date string by a number of days (safe, no timezone drift). */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Yesterday's date as YYYY-MM-DD in the barn's local timezone. */
export function localYesterday(tz: string = BARN_TZ): string {
  return shiftDate(localToday(tz), -1);
}
