import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { MAX_CHAT_SESSIONS } from "../lib/chat-memory.ts";
import { createChatSession, deleteChatSession, getChatSession, listChatSessions, saveChatSession } from "../lib/chat-sessions.ts";

class FakeStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params);
  }

  async first<T>() {
    const row = this.db.prepare(this.sql).get(...(this.params as never[])) as T | undefined;
    return row ?? null;
  }

  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...(this.params as never[])) as T[] };
  }

  async run() {
    this.db.prepare(this.sql).run(...(this.params as never[]));
    return { success: true as const };
  }
}

class FakeD1 {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string) {
    return new FakeStatement(this.db, sql);
  }

  async batch(statements: FakeStatement[]) {
    this.db.exec("BEGIN");
    try {
      for (const statement of statements) await statement.run();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return [];
  }
}

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0019_chat_sessions.sql", import.meta.url), "utf8"));
  return new FakeD1(db) as unknown as D1Database;
}

function clock(start = "2026-10-27T00:00:00.000Z") {
  let millis = Date.parse(start);
  return () => {
    millis += 1000;
    return new Date(millis).toISOString();
  };
}

const user = (id: string, text: string) => ({ id, role: "user" as const, parts: [{ type: "text", text }] });
const assistant = (id: string, text: string) => ({
  id,
  role: "assistant" as const,
  parts: [
    { type: "text", text },
    { type: "tool-list_leads", state: "output-available", toolCallId: `${id}-tool`, input: {}, output: { leads: [] } },
  ],
});

test("会话按 id 隔离消息和草稿，标题来自首条用户消息", async () => {
  const database = openDatabase();
  const now = clock();
  const first = await createChatSession(database, { messages: [user("u1", "对照政策和案例，说说现在做什么")], draft: "还没发" }, now);
  const second = await createChatSession(database, {}, now);
  assert.equal(first.title, "对照政策和案例，说说现在做什么");
  assert.equal(second.title, "新对话");
  assert.equal(first.draft, "还没发");

  const savedSecond = await saveChatSession(database, second.id, { draft: "另一条草稿" }, now);
  assert.equal(savedSecond.updated_at, second.updated_at);
  assert.deepEqual(savedSecond.messages, []);

  const savedFirst = await saveChatSession(
    database,
    first.id,
    { messages: [user("u1", "对照政策和案例，说说现在做什么"), assistant("a1", "先看库里的政策")], draft: "" },
    now,
  );
  assert.notEqual(savedFirst.updated_at, first.updated_at);
  assert.equal(savedFirst.messages.length, 2);
  assert.equal(savedFirst.messages[1]?.parts[1]?.type, "tool-list_leads");
  assert.equal(savedFirst.draft, "");

  const again = await getChatSession(database, first.id);
  const other = await getChatSession(database, second.id);
  assert.equal(again?.messages.length, 2);
  assert.equal(again?.messages[1]?.parts[1]?.type, "tool-list_leads");
  assert.equal(again?.title, "对照政策和案例，说说现在做什么");
  assert.deepEqual(other?.messages, []);
  assert.equal(other?.draft, "另一条草稿");

  const listed = await listChatSessions(database);
  assert.deepEqual(
    listed.map((session) => session.id),
    [first.id, second.id],
  );
});

test("删掉会话后消息一起没，剩下的会话还在", async () => {
  const database = openDatabase();
  const now = clock();
  const first = await createChatSession(database, { messages: [user("u1", "留下这条")] }, now);
  const second = await createChatSession(database, { messages: [user("u2", "另一条")] }, now);
  await deleteChatSession(database, first.id);
  assert.equal(await getChatSession(database, first.id), null);
  const remaining = await listChatSessions(database);
  assert.deepEqual(
    remaining.map((session) => session.id),
    [second.id],
  );
  assert.equal((await getChatSession(database, second.id))?.messages[0]?.id, "u2");
  await assert.rejects(deleteChatSession(database, first.id), /找不到这个会话/);
  await assert.rejects(deleteChatSession(database, "not-a-uuid"), /会话 id 不正确/);
});

test("相同消息不会刷新更新时间，超出会话上限时拒绝新建", async () => {
  const database = openDatabase();
  const now = clock();
  const created = await createChatSession(database, { messages: [user("u1", "原话")] }, now);
  const same = await saveChatSession(database, created.id, { messages: [user("u1", "原话")], draft: "草稿" }, now);
  assert.equal(same.updated_at, created.updated_at);
  assert.equal(same.draft, "草稿");
  assert.equal(same.title, "原话");

  for (let index = 1; index < MAX_CHAT_SESSIONS; index += 1) {
    await createChatSession(database, {}, now);
  }
  await assert.rejects(createChatSession(database, {}, now), /最多保留/);
});
