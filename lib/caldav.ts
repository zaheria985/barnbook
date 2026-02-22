// iCloud CalDAV integration using tsdav
// Requires ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD

import { createDAVClient, DAVClient, DAVCalendar, DAVObject } from "tsdav";

export interface CalendarInfo {
  id: string;
  name: string;
  color: string | null;
  type: "calendar" | "reminders";
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string | null;
  location: string | null;
  raw: string;
}

export interface CalendarReminder {
  uid: string;
  summary: string;
  completed: boolean;
}

// Normalize a date value (Date object or string) to "YYYY-MM-DDT12:00:00.000Z"
// Uses noon UTC so the date never shifts in any US timezone.
export function toNoonUTC(val: string | Date): string {
  const iso = val instanceof Date ? val.toISOString() : String(val);
  const dateOnly = iso.split("T")[0];
  return `${dateOnly}T12:00:00.000Z`;
}

export function isConfigured(): boolean {
  return !!(process.env.ICLOUD_APPLE_ID && process.env.ICLOUD_APP_PASSWORD);
}

export async function createClient() {
  if (!isConfigured()) {
    throw new Error(
      "iCloud not configured. Set ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD."
    );
  }

  const client = await createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: {
      username: process.env.ICLOUD_APPLE_ID!,
      password: process.env.ICLOUD_APP_PASSWORD!,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  return client;
}

function extractField(ical: string, field: string): string | null {
  // Match field value, handling folded lines (continuation lines start with space/tab)
  const regex = new RegExp(`^${field}[^:]*:(.*)`, "m");
  const match = ical.match(regex);
  if (!match) return null;

  let value = match[1].trim();
  // Unfold continuation lines
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

function parseDateTime(value: string): string {
  // Handle YYYYMMDD format (all-day events)
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  // Handle YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  if (/^\d{8}T\d{6}/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const hh = value.slice(9, 11);
    const mm = value.slice(11, 13);
    const ss = value.slice(13, 15);
    const tz = value.endsWith("Z") ? "Z" : "";
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}${tz}`;
  }
  return value;
}

function parseVEvents(ical: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = ical.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const uid = extractField(block, "UID");
    const summary = extractField(block, "SUMMARY");
    const dtstart = extractField(block, "DTSTART");
    const dtend = extractField(block, "DTEND");
    const location = extractField(block, "LOCATION");

    if (uid && summary && dtstart) {
      events.push({
        uid,
        summary,
        dtstart: parseDateTime(dtstart),
        dtend: dtend ? parseDateTime(dtend) : null,
        location,
        raw: block,
      });
    }
  }
  return events;
}

function parseVTodos(ical: string): CalendarReminder[] {
  const reminders: CalendarReminder[] = [];
  const blocks = ical.split("BEGIN:VTODO");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VTODO")[0];
    const uid = extractField(block, "UID");
    const summary = extractField(block, "SUMMARY");
    const status = extractField(block, "STATUS");

    if (uid && summary) {
      reminders.push({
        uid,
        summary,
        completed: status === "COMPLETED",
      });
    }
  }
  return reminders;
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  if (!isConfigured()) {
    throw new Error("iCloud not configured. Set ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD.");
  }

  // Use DAVClient class to access account.homeUrl for raw PROPFIND
  const client = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: {
      username: process.env.ICLOUD_APPLE_ID!,
      password: process.env.ICLOUD_APP_PASSWORD!,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();

  const homeUrl = client.account?.homeUrl;
  const rootUrl = client.account?.rootUrl ?? "";
  if (!homeUrl) throw new Error("CalDAV account discovery failed — no homeUrl");

  // Raw PROPFIND on calendar home — bypasses tsdav's supportedCalendarComponentSet filter
  // which drops collections (like custom iCloud Reminders lists) that lack that property
  const res = await client.propfind({
    url: homeUrl,
    props: {
      "d:displayname": {},
      "ca:calendar-color": {},
      "d:resourcetype": {},
      "c:supported-calendar-component-set": {},
    },
    depth: "1",
  });

  console.log("Raw PROPFIND collections:", res.map((r: Record<string, unknown>) => ({
    href: r.href,
    displayName: (r.props as Record<string, unknown>)?.displayname,
    resourcetype: (r.props as Record<string, unknown>)?.resourcetype
      ? Object.keys((r.props as Record<string, Record<string, unknown>>).resourcetype)
      : [],
    componentSet: (r.props as Record<string, unknown>)?.supportedCalendarComponentSet,
  })));

  const results: CalendarInfo[] = [];

  for (const r of res) {
    const props = r.props as Record<string, unknown> | undefined;
    if (!props?.resourcetype) continue;

    const resourceTypes = Object.keys(props.resourcetype as Record<string, unknown>);
    if (!resourceTypes.includes("calendar")) continue;

    // Parse supported-calendar-component-set
    const compSet = props.supportedCalendarComponentSet as
      | { comp: { _attributes: { name: string } }[] | { _attributes: { name: string } } }
      | undefined;
    let components: string[] = [];
    if (compSet?.comp) {
      components = Array.isArray(compSet.comp)
        ? compSet.comp.map((c) => c._attributes.name)
        : [compSet.comp._attributes.name];
    }

    // Detect type: VTODO = reminders, VEVENT = calendar, unknown = reminders
    const hasVTODO = components.includes("VTODO");
    const hasVEVENT = components.includes("VEVENT");
    const type: "calendar" | "reminders" = hasVTODO ? "reminders"
      : hasVEVENT ? "calendar"
      : "reminders";

    const displayName = props.displayname as string | { _cdata: string } | undefined;
    const name = typeof displayName === "string" ? displayName
      : (displayName as { _cdata?: string })?._cdata ?? "Untitled";

    results.push({
      id: new URL(r.href as string ?? "", rootUrl ?? "").href,
      name,
      color: (props.calendarColor as string) ?? null,
      type,
    });
  }

  return results;
}

export async function fetchEvents(
  calendarIds: string[],
  from: Date,
  to: Date
): Promise<CalendarEvent[]> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();

  const selected = calendars.filter((c: DAVCalendar) =>
    calendarIds.includes(c.url)
  );

  const allEvents: CalendarEvent[] = [];

  for (const cal of selected) {
    const objects: DAVObject[] = await client.fetchCalendarObjects({
      calendar: cal,
      timeRange: {
        start: from.toISOString(),
        end: to.toISOString(),
      },
    });

    for (const obj of objects) {
      if (obj.data) {
        const events = parseVEvents(obj.data as string);
        allEvents.push(...events);
      }
    }
  }

  return allEvents;
}

export async function fetchReminders(
  calendarIds: string[],
  includeCompleted = false
): Promise<CalendarReminder[]> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();

  const selected = calendars.filter((c: DAVCalendar) =>
    calendarIds.includes(c.url)
  );

  const allReminders: CalendarReminder[] = [];

  for (const cal of selected) {
    const objects: DAVObject[] = await client.fetchCalendarObjects({
      calendar: cal,
    });

    for (const obj of objects) {
      if (obj.data) {
        const reminders = parseVTodos(obj.data as string);
        allReminders.push(
          ...reminders.filter((r) => includeCompleted || !r.completed)
        );
      }
    }
  }

  return allReminders;
}

function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export async function writeEvent(
  calendarId: string,
  event: { title: string; start: Date; end: Date; description?: string }
): Promise<string> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarId);

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarId}`);
  }

  const uid = `barnbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@barnbook`;

  const vcalendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barnbook//Ride Window//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(event.start)}`,
    `DTEND:${formatICalDate(event.end)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description}` : "",
    "END:VEVENT",
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

export async function deleteEvent(
  calendarId: string,
  icalUid: string
): Promise<void> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarId);

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarId}`);
  }

  const objects: DAVObject[] = await client.fetchCalendarObjects({ calendar });

  const target = objects.find((obj) => {
    if (!obj.data) return false;
    const uid = extractField(obj.data as string, "UID");
    return uid === icalUid;
  });

  if (target) {
    await client.deleteCalendarObject({
      calendarObject: target,
    });
  }
}

export async function writeReminder(
  calendarId: string,
  reminder: { title: string; due?: string | Date | null; description?: string }
): Promise<string> {
  const client = await createClient();
  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c: DAVCalendar) => c.url === calendarId);

  if (!calendar) {
    throw new Error(`Calendar not found: ${calendarId}`);
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
  calendarId: string,
  uid: string
): Promise<void> {
  return deleteEvent(calendarId, uid);
}
