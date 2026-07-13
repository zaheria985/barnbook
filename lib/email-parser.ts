// Email parser for Venmo receipt HTML ingestion

import { localToday } from "@/lib/dates";

export interface ParsedReceipt {
  amount: number;
  date: string;
  recipient: string;
  note: string | null;
  source: string;
}

/** Extract a transaction amount, preferring a signed amount (Venmo shows the
 *  payment with a +/- sign) over an arbitrary first dollar figure that could be
 *  a fee, running balance, or promo. Returns null if no amount is found. */
function extractAmount(html: string): number | null {
  // Prefer a signed amount with cents, e.g. "- $25.00" / "+ $25.00".
  const signed = html.match(/[-+]\s*\$\s*([\d,]+\.\d{2})/);
  // Then any dollar amount that has explicit cents.
  const withCents = html.match(/\$\s*([\d,]+\.\d{2})/);
  // Last resort: any dollar figure.
  const any = html.match(/\$\s*([\d,]+\.?\d*)/);
  const match = signed || withCents || any;
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** Format a matched date string as YYYY-MM-DD using local calendar components,
 *  never round-tripping through toISOString() (which shifts the day in US TZs). */
function extractDate(html: string): string {
  const dateMatch = html.match(
    /(\w+ \d{1,2},?\s*\d{4})|(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (dateMatch) {
    const parsed = new Date(dateMatch[0]);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return localToday();
}

export function parseVenmoReceipt(html: string): ParsedReceipt | null {
  try {
    const amount = extractAmount(html);
    if (amount === null) return null;

    const date = extractDate(html);

    // Extract recipient: look for "to" or "paid" patterns
    const recipientMatch =
      html.match(/(?:paid|to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i) ||
      html.match(/recipient[:\s]+([^\n<]+)/i);
    const recipient = recipientMatch
      ? recipientMatch[1].trim()
      : "Unknown";

    // Extract note/memo
    const noteMatch =
      html.match(/note[:\s]+([^\n<]+)/i) ||
      html.match(/memo[:\s]+([^\n<]+)/i) ||
      html.match(/for[:\s]+([^\n<]+)/i);
    const note = noteMatch ? noteMatch[1].trim() : null;

    return {
      amount,
      date,
      recipient,
      note,
      source: "venmo_email",
    };
  } catch {
    return null;
  }
}

export function parseGenericReceipt(text: string): ParsedReceipt | null {
  try {
    const amount = extractAmount(text);
    if (amount === null) return null;

    return {
      amount,
      date: localToday(),
      recipient: "Unknown",
      note: text.slice(0, 200),
      source: "email",
    };
  } catch {
    return null;
  }
}

/** A receipt amount we trust enough to auto-create an expense from. Zero,
 *  negative, or absurdly large values indicate a mis-parse and should be
 *  routed to manual review instead. */
export function isPlausibleAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 100000;
}
