-- Existing tasks retain their policy behavior. Manual is a cadence, not a source.
ALTER TABLE agent_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'policy' CHECK (task_type IN ('policy', 'opc'));

CREATE TABLE case_candidates (
  url TEXT PRIMARY KEY,
  feed TEXT NOT NULL CHECK (feed IN ('products', 'demands')),
  payload TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'raw' CHECK (stage IN ('raw', 'dropped', 'interpreted')),
  relevance_score INTEGER,
  relevance_reason TEXT,
  lead_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_case_candidates_queue ON case_candidates(stage, attempts, created_at);
CREATE INDEX idx_case_candidates_lead ON case_candidates(lead_id);

-- Persist pagination while a bounded run is incomplete. Each completed pass starts
-- again at the head of the lookback window; URL dedup makes subsequent passes incremental.
CREATE TABLE case_sync (
  feed TEXT PRIMARY KEY,
  page INTEGER NOT NULL DEFAULT 1,
  cutoff TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE collection_locks (name TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at INTEGER NOT NULL);

INSERT INTO agent_tasks (id, name, task_type, cadence, lookback_days, instruction, enabled)
VALUES ('opcquan-daily', '每日采集 OPC 案例', 'opc', 'daily', 30,
  '采集 OPC圈广场的产品和需求，按现有赛道筛选智能体、知识库、FDE 和软件数字化案例。按原文区分供给和需求，保留原链接和价格信号。', 1);
