CREATE TABLE tracks (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  studio_fit TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  name TEXT NOT NULL,
  list_url TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'generic_list',
  enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE keyword_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  keywords TEXT NOT NULL,
  track_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  track_code TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  region TEXT,
  published_at TEXT,
  score_capability REAL,
  score_funding REAL,
  score_demand REAL,
  score_policy REAL,
  score_competition REAL,
  score_demo REAL,
  score_total REAL,
  origin TEXT NOT NULL DEFAULT 'seed',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE manual_samples (
  id TEXT PRIMARY KEY,
  sampled_at TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('xianyu', 'taobao', 'channels')),
  keyword TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  side TEXT CHECK (side IN ('demand', 'supply', 'content')),
  price_or_signal TEXT,
  track_guess TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE prompt_profiles (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT
);

CREATE TABLE crawl_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_leads_track ON leads (track_code);
CREATE INDEX idx_leads_url ON leads (url);
CREATE INDEX idx_samples_platform ON manual_samples (platform);
CREATE INDEX idx_jobs_created ON crawl_jobs (created_at);
