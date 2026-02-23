-- Radicale settings for self-hosted CalDAV reminders
ALTER TABLE icloud_settings ADD COLUMN use_radicale BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE icloud_settings ADD COLUMN radicale_checklists_collection TEXT;
ALTER TABLE icloud_settings ADD COLUMN radicale_weather_collection TEXT;
ALTER TABLE icloud_settings ADD COLUMN radicale_treatments_collection TEXT;
