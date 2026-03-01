-- Add recurring event support
ALTER TABLE events ADD COLUMN recurrence_rule VARCHAR(20);
ALTER TABLE events ADD COLUMN recurrence_parent_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN is_recurring_instance BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_events_recurrence_parent ON events(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;
