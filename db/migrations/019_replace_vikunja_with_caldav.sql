ALTER TABLE icloud_settings ADD COLUMN write_reminders_calendar_id TEXT;
ALTER TABLE events RENAME COLUMN vikunja_task_id TO reminder_uid;
ALTER TABLE event_checklists RENAME COLUMN vikunja_task_id TO reminder_uid;
ALTER TABLE blanket_reminders RENAME COLUMN vikunja_task_id TO reminder_uid;
ALTER TABLE treatment_reminders RENAME COLUMN vikunja_task_id TO reminder_uid;
DROP TABLE IF EXISTS vikunja_task_map;
DROP TABLE IF EXISTS vikunja_project_map;
