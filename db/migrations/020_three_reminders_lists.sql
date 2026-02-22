-- Split single write_reminders_calendar_id into three separate Reminders list columns
ALTER TABLE icloud_settings ADD COLUMN reminders_checklists_id TEXT;
ALTER TABLE icloud_settings ADD COLUMN reminders_weather_id TEXT;
ALTER TABLE icloud_settings ADD COLUMN reminders_treatments_id TEXT;

UPDATE icloud_settings SET
  reminders_checklists_id = write_reminders_calendar_id,
  reminders_weather_id = write_reminders_calendar_id,
  reminders_treatments_id = write_reminders_calendar_id
WHERE write_reminders_calendar_id IS NOT NULL;

ALTER TABLE icloud_settings DROP COLUMN write_reminders_calendar_id;
