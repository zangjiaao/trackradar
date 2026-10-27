-- 对话多会话。消息按 session_id 留在 D1，关掉标签页后还在。
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  draft TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chat_messages (
  session_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  message_json TEXT NOT NULL,
  PRIMARY KEY (session_id, sort_order)
);

CREATE INDEX idx_chat_sessions_updated ON chat_sessions (updated_at);
