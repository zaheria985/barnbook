import * as caldav from "@/lib/caldav";
import type { CalendarEvent } from "@/lib/caldav";
import { getIcloudSettings } from "@/lib/queries/icloud-sync";
import { withTimeout } from "@/lib/with-timeout";

/**
 * In-memory cache for iCloud event fetches, shared by the calendar month
 * grid, the weekly digest, and the home dashboard.
 *
 * The app runs as a single long-lived Node process (one container), so a
 * module-level Map is sufficient; a restart just means one cold fetch.
 * Entries are keyed by date range. Concurrent requests for the same range
 * share one in-flight promise instead of stacking CalDAV round-trips.
 */

const TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  events: CalendarEvent[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CalendarEvent[]>>();

export type IcloudFetchStatus = "ok" | "timeout" | "error" | "unconfigured";

export interface IcloudFetchResult {
  events: CalendarEvent[];
  status: IcloudFetchStatus;
  fetchedAt: string | null;
}

function key(from: Date, to: Date): string {
  return `${from.toISOString()}|${to.toISOString()}`;
}

/**
 * Fetch iCloud events for a range, serving from cache when fresh.
 * Never throws: failures degrade to `{ events: [], status }`.
 */
export async function getIcloudEvents(
  from: Date,
  to: Date
): Promise<IcloudFetchResult> {
  if (!caldav.isConfigured()) {
    return { events: [], status: "unconfigured", fetchedAt: null };
  }

  const settings = await getIcloudSettings();
  if (!settings || settings.read_calendar_ids.length === 0) {
    return { events: [], status: "unconfigured", fetchedAt: null };
  }

  const k = key(from, to);
  const cached = cache.get(k);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return {
      events: cached.events,
      status: "ok",
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
    };
  }

  let promise = inFlight.get(k);
  if (!promise) {
    promise = withTimeout(
      caldav.fetchEvents(settings.read_calendar_ids, from, to),
      FETCH_TIMEOUT_MS
    ).finally(() => {
      inFlight.delete(k);
    });
    inFlight.set(k, promise);
  }

  try {
    const events = await promise;
    cache.set(k, { events, fetchedAt: Date.now() });
    return { events, status: "ok", fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error("iCloud event fetch failed:", err);
    const status: IcloudFetchStatus =
      err instanceof Error && err.name === "TimeoutError" ? "timeout" : "error";
    // Serve stale data over nothing if we have it.
    if (cached) {
      return {
        events: cached.events,
        status: "ok",
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
      };
    }
    return { events: [], status, fetchedAt: null };
  }
}
