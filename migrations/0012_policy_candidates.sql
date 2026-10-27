-- 回看四步的候选库：先采集入库，再评分、过滤、解读。政策页仍只读 leads。
CREATE TABLE policy_candidates (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_at TEXT,
  region TEXT,
  source_name TEXT,
  body TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('raw', 'scored', 'kept', 'dropped', 'interpreted')),
  relevance_score INTEGER,
  relevance_reason TEXT,
  lead_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_policy_candidates_stage ON policy_candidates (stage);

UPDATE prompt_profiles
SET system_prompt = system_prompt || '回看分四步：先把标题、发表时间、出处和正文采集入库，不因赛道未映射丢掉；再逐条做相关性评分；低于阈值的标为不展示，不进入政策清单；只对留下来的政策做解读。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '回看分四步') = 0;

UPDATE prompt_profiles
SET system_prompt = system_prompt || '已评过分并解读、留在清单里的政策，以及已录入的案例，是确定方向和 demo 的依据。用 list_leads 读取相关性分、机会、福利、如何参与、门槛、联络人，以及案例的价格信号和能力关系。低分过滤的不在清单里。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '确定方向和 demo') = 0;
