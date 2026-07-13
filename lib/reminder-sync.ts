// Best-effort cleanup of CalDAV/Radicale reminders (VTODOs) tied to app records.
// All deletions are non-fatal: a calendar-server hiccup must never block the
// underlying database operation.

import * as caldav from "@/lib/caldav";
import * as radicale from "@/lib/radicale";
import { getIcloudSettings, type IcloudSettings } from "@/lib/queries/icloud-sync";
import { getEvent } from "@/lib/queries/events";
import { getChecklist } from "@/lib/queries/event-checklists";

async function deleteFromChecklists(uid: string, settings: IcloudSettings): Promise<void> {
  if (settings.use_radicale) {
    const url = settings.radicale_checklists_collection;
    if (url) await radicale.deleteReminder(url, uid);
    return;
  }
  const id = settings.reminders_checklists_id;
  if (id) await caldav.deleteReminder(id, uid);
}

/**
 * Delete the reminder VTODOs (main + checklist items) associated with an event.
 * Call BEFORE removing the event row so the stored reminder_uids are still
 * available. Silently does nothing if reminders aren't configured.
 */
export async function deleteRemindersForEvent(eventId: string): Promise<void> {
  const settings = await getIcloudSettings();
  if (!settings) return;

  const listConfigured = settings.use_radicale
    ? settings.radicale_checklists_collection
    : settings.reminders_checklists_id;
  if (!listConfigured) return;
  if (!settings.use_radicale && !caldav.isConfigured()) return;

  const uids: string[] = [];
  const event = await getEvent(eventId);
  if (event?.reminder_uid) uids.push(event.reminder_uid);
  const checklist = await getChecklist(eventId);
  for (const item of checklist) {
    if (item.reminder_uid) uids.push(item.reminder_uid);
  }

  for (const uid of uids) {
    try {
      await deleteFromChecklists(uid, settings);
    } catch (err) {
      console.error(`Failed to delete reminder VTODO ${uid}:`, err);
    }
  }
}
