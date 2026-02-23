// Self-hosted Radicale CalDAV integration for reminders
// Replaces iCloud CalDAV for VTODO writes while keeping iCloud for calendar reads

import { createDAVClient, DAVCalendar, DAVObject } from "tsdav";
import { toNoonUTC } from "@/lib/caldav";

export interface RadicaleCollection {
  id: string;
  name: string;
}

export function isConfigured(): boolean {
  return !!(
    process.env.RADICALE_URL &&
    process.env.RADICALE_USER &&
    process.env.RADICALE_PASSWORD
  );
}

export async function createClient() {
  if (!isConfigured()) {
    throw new Error(
      "Radicale not configured. Set RADICALE_URL, RADICALE_USER, and RADICALE_PASSWORD."
    );
  }

  const client = await createDAVClient({
    serverUrl: process.env.RADICALE_URL!,
    credentials: {
      username: process.env.RADICALE_USER!,
      password: process.env.RADICALE_PASSWORD!,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  return client;
}

function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function extractField(ical: string, field: string): string | null {
  const regex = new RegExp(`^${field}[^:]*:(.*)`, "m");
  const match = ical.match(regex);
  if (!match) return null;

  let value = match[1].trim();
  const lines = ical.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.match(regex));
  if (idx >= 0) {
    for (let i = idx + 1; i < lines.length; i++) {
      if (lines[i].startsWith(" ") || lines[i].startsWith("\t")) {
        value += lines[i].slice(1);
      } else {
        break;
      }
    }
  }
  return value || null;
}

export async function listCollections(): Promise<RadicaleCollection[]> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();

  return calendars
    .filter((cal: DAVCalendar) => {
      const components = cal.components ?? [];
      return components.includes("VTODO");
    })
    .map((cal: DAVCalendar) => ({
      id: cal.url,
      name: typeof cal.displayName === "string" ? cal.displayName : "Untitled",
    }));
}

/**
 * Create a VTODO collection (reminders list) in Radicale.
 * Uses MKCALENDAR with VTODO component support.
 */
export async function createCollection(name: string): Promise<string> {
  const user = process.env.RADICALE_USER!;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `${process.env.RADICALE_URL}/${user}/${slug}/`;

  // MKCALENDAR request body
  const body = `<?xml version="1.0" encoding="UTF-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>${name}</D:displayname>
      <C:supported-calendar-component-set>
        <C:comp name="VTODO"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</C:mkcalendar>`;

  const res = await fetch(url, {
    method: "MKCALENDAR",
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Authorization: "Basic " + Buffer.from(`${user}:${process.env.RADICALE_PASSWORD}`).toString("base64"),
    },
    body,
  });

  if (!res.ok && res.status !== 405) {
    // 405 means collection already exists (Radicale)
    throw new Error(`Failed to create collection: ${res.status} ${res.statusText}`);
  }

  return url;
}

export async function writeReminder(
  collectionUrl: string,
  reminder: { title: string; due?: string | Date | null; description?: string }
): Promise<string> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === collectionUrl);

  if (!calendar) {
    throw new Error(`Radicale collection not found: ${collectionUrl}`);
  }

  const uid = `barnbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@barnbook`;

  const dueDate = reminder.due ? new Date(toNoonUTC(reminder.due)) : null;

  const vcalendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barnbook//Reminder//EN",
    "BEGIN:VTODO",
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    dueDate ? `DUE:${formatICalDate(dueDate)}` : "",
    `SUMMARY:${reminder.title}`,
    reminder.description ? `DESCRIPTION:${reminder.description}` : "",
    "STATUS:NEEDS-ACTION",
    "END:VTODO",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  await client.createCalendarObject({
    calendar,
    filename: `${uid}.ics`,
    iCalString: vcalendar,
  });

  return uid;
}

export async function deleteReminder(
  collectionUrl: string,
  uid: string
): Promise<void> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === collectionUrl);

  if (!calendar) {
    throw new Error(`Radicale collection not found: ${collectionUrl}`);
  }

  const objects: DAVObject[] = await client.fetchCalendarObjects({ calendar });

  const target = objects.find((obj) => {
    if (!obj.data) return false;
    const objUid = extractField(obj.data as string, "UID");
    return objUid === uid;
  });

  if (target) {
    await client.deleteCalendarObject({ calendarObject: target });
  }
}

export interface RadicaleReminder {
  uid: string;
  summary: string;
  completed: boolean;
}

export async function fetchReminders(
  collectionUrls: string[],
  includeCompleted = false
): Promise<RadicaleReminder[]> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();

  const selected = calendars.filter((c: DAVCalendar) =>
    collectionUrls.includes(c.url)
  );

  const allReminders: RadicaleReminder[] = [];

  for (const cal of selected) {
    const objects: DAVObject[] = await client.fetchCalendarObjects({ calendar: cal });

    for (const obj of objects) {
      if (obj.data) {
        const blocks = (obj.data as string).split("BEGIN:VTODO");
        for (let i = 1; i < blocks.length; i++) {
          const block = blocks[i].split("END:VTODO")[0];
          const uid = extractField(block, "UID");
          const summary = extractField(block, "SUMMARY");
          const status = extractField(block, "STATUS");

          if (uid && summary) {
            const isCompleted = status === "COMPLETED";
            if (includeCompleted || !isCompleted) {
              allReminders.push({ uid, summary, completed: isCompleted });
            }
          }
        }
      }
    }
  }

  return allReminders;
}

/**
 * Bootstrap the three default collections if they don't exist.
 * Returns the collection URLs.
 */
export async function ensureDefaultCollections(): Promise<{
  checklists: string;
  weather: string;
  treatments: string;
}> {
  const collections = await listCollections();
  const nameToUrl = new Map(collections.map((c) => [c.name, c.id]));

  const checklists = nameToUrl.get("Barnbook Checklists") ?? await createCollection("Barnbook Checklists");
  const weather = nameToUrl.get("Barnbook Weather") ?? await createCollection("Barnbook Weather");
  const treatments = nameToUrl.get("Barnbook Treatments") ?? await createCollection("Barnbook Treatments");

  return { checklists, weather, treatments };
}
