// Display helpers for raw iCloud/iCal event fields, shared by the digest,
// the calendar month grid, and the home dashboard.

import { shiftDate } from "@/lib/dates";

export interface ICalDisplayEvent {
  uid: string;
  summary: string;
  /** Start date as YYYY-MM-DD. */
  date: string;
  /** Inclusive end date as YYYY-MM-DD (equals `date` for single-day). */
  endDate: string;
  allDay: boolean;
  /** Display time like "9:15 AM", or null when all-day. */
  time: string | null;
  location: string | null;
  /** Minutes from midnight, for sorting within a day. All-day sorts first. */
  sortTime: number;
}

export function formatTime12h(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === "00" ? `${display} ${suffix}` : `${display}:${m} ${suffix}`;
}

/** Parse a date string to YYYY-MM-DD, handling postgres ISO and iCal formats. */
export function toDateKey(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (dateStr.includes("T")) return dateStr.split("T")[0];
  return dateStr;
}

/** Sort-friendly minutes-from-midnight from a time string or ISO datetime. */
export function parseSortTime(
  timeStr: string | null,
  dateStr: string
): number {
  if (timeStr) {
    const parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (dateStr.includes("T")) {
    const timePart = dateStr.split("T")[1];
    if (timePart) {
      const parts = timePart.replace("Z", "").split(":");
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }
  }
  return 0;
}

/** Display time for an iCal dtstart, or "All day". */
export function displayTimeFromIcal(dtstart: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dtstart)) return "All day";
  if (dtstart.includes("T")) {
    const timePart = dtstart.split("T")[1];
    if (timePart) {
      const hhmm = timePart.replace("Z", "").substring(0, 5);
      return formatTime12h(hhmm);
    }
  }
  return "All day";
}

/**
 * Normalize a raw iCal event for calendar display.
 *
 * iCal DTEND is exclusive for all-day events (an event ending Aug 2 carries
 * DTEND Aug 3), so all-day multi-day spans subtract one day to get the
 * inclusive end date users expect.
 */
export function normalizeICalEvent(ev: {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string | null;
  location: string | null;
}): ICalDisplayEvent {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(ev.dtstart);
  const date = toDateKey(ev.dtstart);

  let endDate = date;
  if (ev.dtend) {
    const rawEnd = toDateKey(ev.dtend);
    endDate = allDay && rawEnd > date ? shiftDate(rawEnd, -1) : rawEnd;
    if (endDate < date) endDate = date;
  }

  const timeDisplay = displayTimeFromIcal(ev.dtstart);
  return {
    uid: ev.uid,
    summary: ev.summary,
    date,
    endDate,
    allDay,
    time: timeDisplay === "All day" ? null : timeDisplay,
    location: ev.location,
    sortTime: parseSortTime(null, ev.dtstart),
  };
}
