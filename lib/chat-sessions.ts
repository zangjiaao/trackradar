import type { UIMessage } from "ai";
import {
  MAX_CHAT_SESSIONS,
  NEW_CHAT_TITLE,
  assertSessionId,
  coerceStoredMessages,
  prepareSessionDraft,
  prepareSessionMessages,
  sessionTitleFromMessages,
  type ChatSessionDetail,
  type ChatSessionSummary,
} from "@/lib/chat-memory";

type SessionRow = {
  id: string;
  title: string;
  draft: string;
  created_at: string;
  updated_at: string;
};

function summaryOf(row: SessionRow): ChatSessionSummary {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function readMessages(database: D1Database, id: string): Promise<UIMessage[]> {
  const { results } = await database
    .prepare("SELECT message_json FROM chat_messages WHERE session_id = ? ORDER BY sort_order ASC")
    .bind(id)
    .all<{ message_json: string }>();
  const parsed = results.flatMap((row) => {
    try {
      return coerceStoredMessages([JSON.parse(row.message_json) as unknown]);
    } catch {
      return [];
    }
  });
  return parsed;
}

async function requireSession(database: D1Database, id: string): Promise<SessionRow> {
  assertSessionId(id);
  const row = await database
    .prepare("SELECT id, title, draft, created_at, updated_at FROM chat_sessions WHERE id = ?")
    .bind(id)
    .first<SessionRow>();
  if (!row) throw new Error("找不到这个会话。");
  return row;
}

function sameMessages(left: UIMessage[], right: UIMessage[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((message, index) => JSON.stringify(message) === JSON.stringify(right[index]));
}

async function writeSession(
  database: D1Database,
  id: string,
  title: string,
  draft: string,
  updatedAt: string,
  messages: UIMessage[] | null,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  if (messages) {
    statements.push(database.prepare("DELETE FROM chat_messages WHERE session_id = ?").bind(id));
    for (const [index, message] of messages.entries()) {
      statements.push(
        database
          .prepare("INSERT INTO chat_messages (session_id, sort_order, message_json) VALUES (?, ?, ?)")
          .bind(id, index, JSON.stringify(message)),
      );
    }
  }
  statements.push(
    database.prepare("UPDATE chat_sessions SET title = ?, draft = ?, updated_at = ? WHERE id = ?").bind(title, draft, updatedAt, id),
  );
  await database.batch(statements);
}

export async function listChatSessions(database: D1Database): Promise<ChatSessionSummary[]> {
  const { results } = await database
    .prepare("SELECT id, title, draft, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC, created_at DESC")
    .all<SessionRow>();
  return results.map(summaryOf);
}

export async function getChatSession(database: D1Database, id: string): Promise<ChatSessionDetail | null> {
  assertSessionId(id);
  const row = await database
    .prepare("SELECT id, title, draft, created_at, updated_at FROM chat_sessions WHERE id = ?")
    .bind(id)
    .first<SessionRow>();
  if (!row) return null;
  return { ...summaryOf(row), draft: row.draft, messages: await readMessages(database, id) };
}

export async function createChatSession(
  database: D1Database,
  input: { messages?: unknown; draft?: unknown } = {},
  now: () => string = () => new Date().toISOString(),
): Promise<ChatSessionDetail> {
  const count = await database.prepare("SELECT COUNT(*) AS total FROM chat_sessions").first<{ total: number }>();
  if (Number(count?.total ?? 0) >= MAX_CHAT_SESSIONS) {
    throw new Error(`最多保留 ${MAX_CHAT_SESSIONS} 个会话。可以先删掉不用的。`);
  }
  const messages = input.messages === undefined ? [] : prepareSessionMessages(input.messages);
  const draft = input.draft === undefined ? "" : prepareSessionDraft(input.draft);
  const id = crypto.randomUUID();
  const timestamp = now();
  const title = sessionTitleFromMessages(messages);
  await database
    .prepare("INSERT INTO chat_sessions (id, title, draft, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, title || NEW_CHAT_TITLE, draft, timestamp, timestamp)
    .run();
  if (messages.length > 0) {
    await writeSession(database, id, title, draft, timestamp, messages);
  }
  return { id, title, draft, created_at: timestamp, updated_at: timestamp, messages };
}

export async function saveChatSession(
  database: D1Database,
  id: string,
  input: { messages?: unknown; draft?: unknown },
  now: () => string = () => new Date().toISOString(),
): Promise<ChatSessionDetail> {
  if (input.messages === undefined && input.draft === undefined) {
    throw new Error("需要 messages 或草稿。");
  }
  const existing = await requireSession(database, id);
  const previousMessages = input.messages === undefined ? null : await readMessages(database, id);
  const messages = input.messages === undefined ? null : prepareSessionMessages(input.messages);
  const draft = input.draft === undefined ? existing.draft : prepareSessionDraft(input.draft);
  const messagesChanged = messages !== null && (previousMessages === null || !sameMessages(previousMessages, messages));
  const draftChanged = draft !== existing.draft;
  const title = messagesChanged && messages ? sessionTitleFromMessages(messages) : existing.title;
  const updatedAt = messagesChanged ? now() : existing.updated_at;
  if (messagesChanged || draftChanged) {
    await writeSession(database, id, title, draft, updatedAt, messagesChanged ? messages : null);
  }
  return {
    id,
    title,
    draft,
    created_at: existing.created_at,
    updated_at: updatedAt,
    messages: messages ?? previousMessages ?? (await readMessages(database, id)),
  };
}

export async function deleteChatSession(database: D1Database, id: string): Promise<void> {
  await requireSession(database, id);
  await database.batch([
    database.prepare("DELETE FROM chat_messages WHERE session_id = ?").bind(id),
    database.prepare("DELETE FROM chat_sessions WHERE id = ?").bind(id),
  ]);
}
