import { NextRequest, NextResponse } from "next/server";
import * as caldav from "@/lib/caldav";
import * as vikunja from "@/lib/vikunja";
import { getSettings } from "@/lib/queries/weather-settings";
import { getKeywords } from "@/lib/queries/detection-keywords";
import { createEvent } from "@/lib/queries/events";
import { getSchedule } from "@/lib/queries/ride-schedule";
import { isConfigured as weatherConfigured, getForecast, getRecentRain, getLocalHour } from "@/lib/openweathermap";
import { scoreDays } from "@/lib/weather-rules";
import pool from "@/lib/db";
import {
  getIcloudSettings,
  getSyncState,
  upsertSyncState,
  replaceSuggestedWindows,
} from "@/lib/queries/icloud-sync";

export async function POST(request: NextRequest) {
  // Auth via bearer token (cron) or session
  const authHeader = request.headers.get("authorization");
  const syncSecret = process.env.ICLOUD_SYNC_SECRET;

  if (!syncSecret || !authHeader || authHeader !== `Bearer ${syncSecret}`) {
    // Fall back to session auth for manual trigger
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!caldav.isConfigured()) {
    return NextResponse.json(
      { error: "iCloud not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const icloudSettings = await getIcloudSettings();
    if (!icloudSettings || icloudSettings.read_calendar_ids.length === 0) {
      return NextResponse.json(
        { error: "No calendars selected. Configure in Settings > Integrations." },
        { status: 400 }
      );
    }

    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);

    // Fetch all iCloud events for the next 30 days
    const icalEvents = await caldav.fetchEvents(
      icloudSettings.read_calendar_ids,
      from,
      to
    );

    // --- Keyword scan ---
    const keywords = await getKeywords();
    let keywordsMatched = 0;

    for (const icalEvent of icalEvents) {
      const titleLower = icalEvent.summary.toLowerCase();

      for (const kw of keywords) {
        if (!titleLower.includes(kw.keyword.toLowerCase())) continue;

        // Check if already tracked
        const existing = await getSyncState(icalEvent.uid);
        if (existing) continue;

        // Create unconfirmed Barnbook event
        const startDate = icalEvent.dtstart.split("T")[0];
        const endDate = icalEvent.dtend ? icalEvent.dtend.split("T")[0] : null;

        const created = await createEvent({
          title: icalEvent.summary,
          event_type: kw.suggested_event_type,
          start_date: startDate,
          end_date: endDate,
          location: icalEvent.location,
          notes: "Auto-detected from iCloud calendar",
        });

        await upsertSyncState(icalEvent.uid, created.id, "icloud");
        keywordsMatched++;
        break; // Only match first keyword per event
      }
    }

    // --- Ride window calculation ---
    let windowsSuggested = 0;
    const weatherSettings = await getSettings();
    const rideSlots = await getSchedule();

    if (
      weatherConfigured() &&
      weatherSettings?.location_lat &&
      weatherSettings?.location_lng
    ) {
      const lat = Number(weatherSettings.location_lat);
      const lng = Number(weatherSettings.location_lng);

      const [forecast, recentRain] = await Promise.all([
        getForecast(lat, lng),
        getRecentRain(lat, lng, weatherSettings.rain_window_hours).catch(() => []),
      ]);

      const tzOffset = forecast.timezone_offset;

      const scored = scoreDays(
        forecast.daily,
        weatherSettings,
        recentRain,
        forecast.current,
        forecast.hourly,
        rideSlots,
        tzOffset
      );

      // --- Blanket reminders ---
      if (vikunja.isConfigured()) {
        const { getReminder, createReminder, deleteOldReminders } = await import("@/lib/queries/blanket-reminders");
        const { getProjectId } = await import("@/lib/queries/vikunja-projects");

        // Clean up old reminders
        await deleteOldReminders();

        for (const day of scored) {
          if (day.blanket_low_f === null) continue;

          // Check if already reminded
          const existing = await getReminder(day.date);
          if (existing) continue;

          try {
            const projectId = await getProjectId("weather_alerts");
            const task = await vikunja.createTask({
              title: `\uD83D\uDC34 Put blanket on tonight \u2014 low ${day.blanket_low_f}\u00B0F`,
              due_date: `${day.date}T18:00:00`,
              project_id: projectId,
            });
            await createReminder(day.date, day.blanket_low_f, String(task.id));
          } catch (err) {
            console.error("Failed to create blanket reminder:", err);
            // Fire-and-forget — don't block sync
          }
        }
      }

      // Build busy times from iCloud events
      const busySlots = icalEvents
        .filter((e) => e.dtstart && e.dtend)
        .map((e) => ({
          date: e.dtstart.split("T")[0],
          start: e.dtstart,
          end: e.dtend!,
        }));

      const windows: {
        date: string;
        start_time: string;
        end_time: string;
        weather_score: string;
        weather_notes: string[];
        avg_temp_f: number | null;
        ical_uid: string | null;
      }[] = [];

      // For each day in the forecast window
      for (const day of scored) {
        if (day.score === "red") continue;

        const dayDate = day.date;
        const dayOfWeek = new Date(dayDate + "T12:00:00").getDay();
        const scheduledSlots = rideSlots.filter((s) => s.day_of_week === dayOfWeek);

        // Get sunrise/sunset for daylight bounds (using local timezone)
        const sunriseHour = day.forecast.sunrise
          ? getLocalHour(day.forecast.sunrise, tzOffset)
          : 6;
        const sunsetHour = day.forecast.sunset
          ? getLocalHour(day.forecast.sunset, tzOffset)
          : 20;

        // If ride schedule has slots for this day, use those.
        // Otherwise, generate 3-hour candidate windows from sunrise to sunset.
        const candidateSlots: { start_time: string; end_time: string }[] = [];

        if (scheduledSlots.length > 0) {
          candidateSlots.push(
            ...scheduledSlots.map((s) => ({
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );
        } else {
          // Generate 3-hour blocks starting 1 hour after sunrise
          const firstHour = sunriseHour + 1;
          for (let h = firstHour; h + 3 <= sunsetHour; h += 3) {
            candidateSlots.push({
              start_time: `${String(h).padStart(2, "0")}:00:00`,
              end_time: `${String(h + 3).padStart(2, "0")}:00:00`,
            });
          }
        }

        for (const slot of candidateSlots) {
          const slotStartHour = parseInt(slot.start_time.split(":")[0], 10);
          const slotEndHour = parseInt(slot.end_time.split(":")[0], 10);

          // Skip if outside daylight hours
          if (slotStartHour < sunriseHour || slotEndHour > sunsetHour) continue;

          // Check for iCloud event conflicts
          const hasConflict = busySlots.some((busy) => {
            if (busy.date !== dayDate) return false;
            const busyStart = busy.start.includes("T")
              ? busy.start.split("T")[1]?.slice(0, 5) ?? "00:00"
              : "00:00";
            const busyEnd = busy.end.includes("T")
              ? busy.end.split("T")[1]?.slice(0, 5) ?? "23:59"
              : "23:59";
            return slot.start_time < busyEnd && slot.end_time > busyStart;
          });

          if (hasConflict) continue;

          // Calculate average temperature for this window
          let avgTempF: number | null = null;
          const slotHourlyTemps = forecast.hourly.filter((h) => {
            const hDate = h.hour.split("T")[0];
            if (hDate !== dayDate) return false;
            const hHour = getLocalHour(h.hour, tzOffset);
            return hHour >= slotStartHour && hHour < slotEndHour;
          });
          if (slotHourlyTemps.length > 0) {
            avgTempF = Math.round(
              slotHourlyTemps.reduce((sum, h) => sum + h.temp_f, 0) / slotHourlyTemps.length
            );
          } else {
            // Fall back to daytime temperature for days without hourly data
            avgTempF = Math.round(day.forecast.day_f);
          }

          windows.push({
            date: dayDate,
            start_time: slot.start_time,
            end_time: slot.end_time,
            weather_score: day.score,
            weather_notes: [...day.reasons, ...day.notes],
            avg_temp_f: avgTempF,
            ical_uid: null,
          });
        }
      }

      // Save windows to DB (iCloud write happens on approval in digest)
      await replaceSuggestedWindows(windows);
      windowsSuggested = windows.length;
    }

    // --- Treatment reminders ---
    if (vikunja.isConfigured()) {
      try {
        const {
          getSchedules: getTreatmentSchedules,
          getReminder: getTreatmentReminder,
          createReminder: createTreatmentReminder,
          countReminders: countTreatmentReminders,
          deleteOldReminders: deleteOldTreatmentReminders,
        } = await import("@/lib/queries/treatment-schedules");
        const { getProjectId } = await import("@/lib/queries/vikunja-projects");

        await deleteOldTreatmentReminders();

        const schedules = await getTreatmentSchedules();
        const todayDate = from.toISOString().split("T")[0];
        const sevenDaysOut = new Date(from);
        sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
        const sevenDaysOutDate = sevenDaysOut.toISOString().split("T")[0];

        for (const schedule of schedules) {
          const startDate = new Date(schedule.start_date + "T00:00:00");
          const freqMs = schedule.frequency_days * 86400000;

          // Calculate due dates in the next 7 days
          for (let n = 0; n < 1000; n++) {
            const dueMs = startDate.getTime() + n * freqMs;
            const dueDate = new Date(dueMs).toISOString().split("T")[0];

            // Stop if past 7-day window
            if (dueDate > sevenDaysOutDate) break;

            // Skip dates before today
            if (dueDate < todayDate) continue;

            // Skip dates past end_date
            if (schedule.end_date && dueDate > schedule.end_date) break;

            // Check occurrence limit
            if (schedule.occurrence_count) {
              const count = await countTreatmentReminders(schedule.id);
              if (count >= schedule.occurrence_count) break;
            }

            // Skip if already reminded
            const existing = await getTreatmentReminder(schedule.id, dueDate);
            if (existing) continue;

            try {
              const projectId = await getProjectId("treatments");
              const title = schedule.horse_name
                ? `\uD83D\uDC8A ${schedule.name} \u2014 ${schedule.horse_name}`
                : `\uD83D\uDC8A ${schedule.name}`;
              const task = await vikunja.createTask({
                title,
                due_date: `${dueDate}T09:00:00`,
                project_id: projectId,
              });
              await createTreatmentReminder(schedule.id, dueDate, String(task.id));
            } catch (err) {
              console.error("Failed to create treatment reminder:", err);
            }
          }
        }
      } catch (err) {
        console.error("Treatment reminder sync failed:", err);
        // Fire-and-forget — don't block sync
      }
    }

    // --- Auto-push confirmed event checklists to Vikunja ---
    let checklistsPushed = 0;
    if (vikunja.isConfigured()) {
      try {
        const { getChecklist } = await import("@/lib/queries/event-checklists");
        const { getProjectId } = await import("@/lib/queries/vikunja-projects");

        // Find confirmed events with checklists that haven't been pushed
        const unpushed = await pool.query(
          `SELECT DISTINCT e.id, e.title, e.event_type, e.start_date, e.location
           FROM events e
           JOIN event_checklists ec ON ec.event_id = e.id
           WHERE e.is_confirmed = true
             AND e.vikunja_task_id IS NULL
             AND e.start_date >= CURRENT_DATE`,
        );

        for (const event of unpushed.rows) {
          try {
            const projectId = await getProjectId("event_checklists");
            const mainTask = await vikunja.createTask({
              title: event.title,
              description: `${event.event_type} | ${event.location || "No location"}`,
              due_date: event.start_date,
              project_id: projectId,
            });

            await pool.query(
              `INSERT INTO vikunja_task_map (vikunja_task_id, event_id, sync_type)
               VALUES ($1, $2, 'push')`,
              [String(mainTask.id), event.id]
            );
            await pool.query(
              `UPDATE events SET vikunja_task_id = $1 WHERE id = $2`,
              [String(mainTask.id), event.id]
            );

            const checklist = await getChecklist(event.id);
            for (const item of checklist) {
              const subTask = await vikunja.createTask({
                title: item.title,
                due_date: item.due_date,
                project_id: projectId,
              });
              await pool.query(
                `INSERT INTO vikunja_task_map (vikunja_task_id, checklist_id, sync_type)
                 VALUES ($1, $2, 'push')`,
                [String(subTask.id), item.id]
              );
              await pool.query(
                `UPDATE event_checklists SET vikunja_task_id = $1 WHERE id = $2`,
                [String(subTask.id), item.id]
              );
            }

            checklistsPushed++;
          } catch (err) {
            console.error(`Failed to auto-push checklist for event ${event.id}:`, err);
          }
        }
      } catch (err) {
        console.error("Checklist auto-push failed:", err);
      }
    }

    return NextResponse.json({
      events_found: icalEvents.length,
      keywords_matched: keywordsMatched,
      windows_suggested: windowsSuggested,
      checklists_pushed: checklistsPushed,
    });
  } catch (error) {
    console.error("iCloud sync failed:", error);
    return NextResponse.json(
      { error: "iCloud sync failed" },
      { status: 500 }
    );
  }
}
