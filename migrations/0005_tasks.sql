CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL,
  lookback_days INTEGER NOT NULL DEFAULT 365,
  instruction TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT
);

ALTER TABLE crawl_jobs ADD COLUMN task_id TEXT;
