import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { authorizeAgent, createAgentKey, listAgentKeys, revokeAgentKey } from "../lib/agent-key.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE agent_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
  `);
  const statement = (sql: string, params: unknown[]) => ({
    bind(...next: unknown[]) {
      return statement(sql, next);
    },
    async first<T>() {
      return (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async all<T>() {
      return { results: db.prepare(sql).all(...(params as never[])) as T[] };
    },
    async run() {
      db.prepare(sql).run(...(params as never[]));
      return { success: true };
    },
  });
  return {
    prepare(sql: string) {
      return statement(sql, []);
    },
  } as D1Database;
}

test("创建钥匙只保存哈希，原文能通过读取接口", async () => {
  const db = database();
  const created = await createAgentKey(db, "办公室");
  const row = await db.prepare("SELECT token_hash, token_prefix FROM agent_keys").first<{ token_hash: string; token_prefix: string }>();
  assert.ok(row);
  assert.equal(row.token_hash.includes(created.key), false);
  assert.equal(row.token_prefix, created.key.slice(0, 12));
  const denied = await authorizeAgent(db, new Request("https://trackradar.oak-studio.org/api/radar/brief", { method: "POST" }));
  assert.equal(denied?.status, 401);
  const allowed = await authorizeAgent(
    db,
    new Request("https://trackradar.oak-studio.org/api/radar/brief", {
      method: "POST",
      headers: { authorization: `Bearer ${created.key}` },
    }),
  );
  assert.equal(allowed, null);
  await revokeAgentKey(db, created.id);
  const revoked = await authorizeAgent(
    db,
    new Request("https://trackradar.oak-studio.org/api/radar/brief", {
      method: "POST",
      headers: { authorization: `Bearer ${created.key}` },
    }),
  );
  assert.equal(revoked?.status, 401);
  assert.equal((await listAgentKeys(db)).length, 0);
});
