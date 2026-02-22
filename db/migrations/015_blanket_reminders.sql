CREATE TABLE blanket_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  overnight_low_f INTEGER NOT NULL,
  vikunja_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
