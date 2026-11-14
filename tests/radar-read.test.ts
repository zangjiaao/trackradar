import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { RADAR_BRIEF_DEFAULT, RadarInputError, radarBrief, radarLead } from "../lib/radar-read.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

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
}

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      track_code TEXT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      summary TEXT,
      relevant_excerpt TEXT,
      opportunity_note TEXT,
      studio_angle TEXT,
      subsidy_note TEXT,
      participation_note TEXT,
      who_can_apply TEXT,
      contact_note TEXT,
      window_note TEXT,
      region TEXT,
      side TEXT,
      site TEXT,
      signal TEXT,
      kind TEXT NOT NULL,
      published_at TEXT,
      score_capability REAL,
      score_funding REAL,
      score_demand REAL,
      score_policy REAL,
      score_competition REAL,
      score_demo REAL,
      score_total REAL,
      origin TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sources (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE policy_candidates (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      stage TEXT,
      relevance_score INTEGER,
      relevance_reason TEXT,
      updated_at TEXT
    );
    CREATE TABLE case_candidates (
      url TEXT PRIMARY KEY, lead_id TEXT, stage TEXT, relevance_score INTEGER, relevance_reason TEXT
    );
    CREATE TABLE lead_tracks (
      lead_id TEXT NOT NULL,
      track_code TEXT NOT NULL,
      PRIMARY KEY (lead_id, track_code)
    );
  `);
  return db;
}

function database(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      return new FakeStatement(db, sql);
    },
  } as unknown as D1Database;
}

function seed(db: DatabaseSync) {
  db.prepare("INSERT INTO sources (id, name) VALUES (?, ?)").run("src-xa", "西安工信局");
  const insert = db.prepare(
    `INSERT INTO leads (
      id, source_id, track_code, title, url, studio_angle, subsidy_note, window_note, signal, kind, region, published_at, score_total, origin, created_at, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?)`,
  );
  insert.run(A, "src-xa", "T09", "较早的政策", "https://example.com/a", "较早解读", null, null, null, "policy", "西安", "2026-11-01", 10, "2026-11-10T00:00:00.000Z", null);
  insert.run(B, "src-xa", "T01", "知识库补贴", "https://example.com/b", "可做知识库 demo", "不超过 50%", "11月30日前", null, "policy", "西安", "2026-11-02", 72, "2026-11-11T00:00:00.000Z", null);
  insert.run(C, null, "T02", "智能体代运营", "https://example.com/c", null, null, null, "报价 8000", "case", null, null, 40, "2026-11-12T00:00:00.000Z", "市场上在找智能体");
  insert.run(D, "src-xa", "T02", "同一时刻更后的编号", "https://example.com/d", "同一秒入库", null, null, null, "policy", "西安", "2026-11-12", 15, "2026-11-12T00:00:00.000Z", null);
  db.prepare("INSERT INTO lead_tracks (lead_id, track_code) VALUES (?, ?)").run(B, "T01");
  db.prepare("INSERT INTO lead_tracks (lead_id, track_code) VALUES (?, ?)").run(B, "T09");
  db.prepare(
    "INSERT INTO policy_candidates (id, lead_id, stage, relevance_score, relevance_reason, updated_at) VALUES (?, ?, 'interpreted', ?, ?, ?)",
  ).run("old", B, 20, "旧理由", "2026-11-11T00:00:00.000Z");
  db.prepare(
    "INSERT INTO policy_candidates (id, lead_id, stage, relevance_score, relevance_reason, updated_at) VALUES (?, ?, 'interpreted', ?, ?, ?)",
  ).run("new", B, 74, "软件数改", "2026-11-11T01:00:00.000Z");
  db.prepare(
    "INSERT INTO policy_candidates (id, lead_id, stage, relevance_score, relevance_reason, updated_at) VALUES (?, ?, 'dropped', ?, ?, ?)",
  ).run("drop", B, 1, "不该出现", "2026-11-12T00:00:00.000Z");
}

test("没有游标时只给最新一页，游标停在最新一条", async () => {
  const db = openDatabase();
  seed(db);
  const brief = await radarBrief(database(db), { limit: 2 });
  assert.deepEqual(
    brief.items.map((item) => item.id),
    [C, D],
  );
  assert.equal(brief.has_more, false);
  assert.deepEqual(brief.cursor, { created_at: "2026-11-12T00:00:00.000Z", id: D });
  assert.equal(brief.items[0]?.kind, "case");
  assert.equal(brief.items[0]?.signal, "报价 8000");
  assert.equal(brief.items[0]?.reading, "市场上在找智能体");
});

test("带上游标后只返回更晚入库的线索，同一时刻用编号断开", async () => {
  const db = openDatabase();
  seed(db);
  const first = await radarBrief(database(db), {
    since: "2026-11-10T00:00:00.000Z",
    after_id: A,
    limit: 2,
  });
  assert.deepEqual(
    first.items.map((item) => item.id),
    [B, C],
  );
  assert.equal(first.has_more, true);
  assert.equal(first.cursor?.id, C);
  const policy = first.items[0];
  assert.equal(policy?.tracks, "T09、T01");
  assert.equal(policy?.relevance_score, 74);
  assert.equal(policy?.relevance_reason, "软件数改");
  assert.equal(policy?.opportunity, "可做知识库 demo");
  assert.equal(policy?.window, "11月30日前");
  assert.equal(policy?.source_name, "西安工信局");

  const second = await radarBrief(database(db), {
    since: first.cursor?.created_at,
    after_id: first.cursor?.id,
    limit: 2,
  });
  assert.deepEqual(
    second.items.map((item) => item.id),
    [D],
  );
  assert.equal(second.has_more, false);

  const again = await radarBrief(database(db), { since: second.cursor?.created_at, after_id: second.cursor?.id });
  assert.deepEqual(again.items, []);
  assert.equal(again.has_more, false);
  assert.deepEqual(again.cursor, second.cursor);
});

test("默认只取最新二十条，不把更早的历史翻出来", async () => {
  const db = openDatabase();
  const insert = db.prepare(
    "INSERT INTO leads (id, title, url, kind, origin, created_at) VALUES (?, ?, ?, 'policy', 'agent', ?)",
  );
  for (let index = 0; index < RADAR_BRIEF_DEFAULT + 5; index += 1) {
    const stamp = `2026-11-01T00:00:${String(index).padStart(2, "0")}.000Z`;
    insert.run(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, `第 ${index} 条`, `https://example.com/${index}`, stamp);
  }
  const brief = await radarBrief(database(db));
  assert.equal(brief.items.length, RADAR_BRIEF_DEFAULT);
  assert.equal(brief.items[0]?.title, "第 5 条");
  assert.equal(brief.items.at(-1)?.title, "第 24 条");
  assert.equal(brief.has_more, false);
});

test("单条读取带回解读，没有这条时为空", async () => {
  const db = openDatabase();
  seed(db);
  const found = await radarLead(database(db), { id: B.toUpperCase() });
  assert.equal(found.lead?.id, B);
  assert.equal(found.lead?.reading, "可做知识库 demo");
  assert.equal(found.lead?.subsidy, "不超过 50%");
  const missing = await radarLead(database(db), { id: "99999999-9999-4999-8999-999999999999" });
  assert.equal(missing.lead, null);
});

test("过长解读会截断，密钥字段不在卡片里", async () => {
  const db = openDatabase();
  const long = "解".repeat(900);
  db.prepare(
    "INSERT INTO leads (id, title, url, studio_angle, kind, origin, created_at) VALUES (?, ?, ?, ?, 'policy', 'agent', ?)",
  ).run(A, "长解读", "https://example.com/long", long, "2026-11-12T00:00:00.000Z");
  const brief = await radarBrief(database(db), { limit: 1 });
  const reading = brief.items[0]?.reading ?? "";
  assert.equal([...reading].length, 801);
  assert.equal(reading.endsWith("…"), true);
  assert.equal("api_key" in (brief.items[0] ?? {}), false);
  const one = await radarLead(database(db), { id: A });
  assert.equal(one.lead?.reading, long);
});

test("坏参数会拒绝", async () => {
  const db = database(openDatabase());
  await assert.rejects(() => radarBrief(db, { limit: 0 }), RadarInputError);
  await assert.rejects(() => radarBrief(db, { since: "2026-11-12" }), RadarInputError);
  await assert.rejects(() => radarBrief(db, { after_id: A }), RadarInputError);
  await assert.rejects(() => radarLead(db, { id: "lead-1" }), RadarInputError);
  await assert.rejects(() => radarLead(db, {}), RadarInputError);
});
