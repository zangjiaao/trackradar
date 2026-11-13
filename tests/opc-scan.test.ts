import assert from "node:assert/strict";
import test from "node:test";
import { migratedDatabase } from "./helpers/d1.ts";
import { runOpcScan } from "../lib/opc-scan.ts";
import { parseOpcPage, fetchOpcPage, type OpcFeed, type OpcItem, type OpcPage } from "../lib/opc-feed.ts";
import { parseCaseAssessments, type CaseAssessor, type CaseAssessment } from "../lib/case-assess.ts";
import { radarBrief, radarLead } from "../lib/radar-read.ts";
import { parseTaskInput } from "../lib/task-input.ts";
import { tasksDue, DAILY_CRON, WEEKLY_CRON } from "../lib/collect.ts";

const now = new Date("2026-11-13T08:00:00.000Z");
const request = { trigger: "manual" as const, lookbackDays: 30, now };
function item(id: number, feed: OpcFeed = "products", stamp = "2026-11-01T00:00:00.000Z"): OpcItem {
  return { url: `https://www.opcquan.com/${feed === "products" ? "projects" : "plaza"}/${id}`, feed,
    title: `企业知识库 ${id}`, body: "用 RAG 建立知识库，接入数字员工。作者报价 8000 元。", publishedAt: stamp, region: "深圳", facts: "" };
}
const page = (items: OpcItem[], totalPages = 1): OpcPage => ({ items, totalPages, oldest: items.at(-1)?.publishedAt ?? null });
const emptyFeed = async () => page([]);
function assessment(item: OpcItem, score = 85): CaseAssessment {
  return { url: item.url, score, reason: "具体的知识库软件交付", side: "supply", tracks: ["T01"], summary: item.body, fit: "可用 RAG 和 FDE 交付企业知识库", signal: "作者报价 8000 元" };
}
const assess: CaseAssessor = async (items) => new Map(items.map((item) => [item.url, assessment(item)]));

test("迁移保留旧任务为政策，预置每天30天OPC任务，手动任务不进入任一Cron", () => {
  const { sqlite } = migratedDatabase((db) => {
    db.exec("INSERT INTO agent_tasks (id, name, cadence, instruction) VALUES ('legacy', '旧政策任务', 'weekly', '回看政策')");
  });
  const tasks = sqlite.prepare("SELECT * FROM agent_tasks").all() as { cadence: "daily"; task_type: string; lookback_days: number; enabled: number }[];
  assert.ok(tasks.find((task) => task.task_type === "opc" && task.lookback_days === 30 && task.cadence === "daily"));
  assert.equal(tasks.find((task) => task.cadence === "weekly")?.task_type, "policy");
  const manual = parseTaskInput({ name: "手动采集", cadence: "manual", taskType: "opc" });
  assert.equal(manual.lookbackDays, 30);
  assert.deepEqual(tasksDue(DAILY_CRON, [manual]), []);
  assert.deepEqual(tasksDue(WEEKLY_CRON, [manual]), []);
  assert.equal(parseTaskInput({ name: "旧接口任务" }).taskType, "policy");
  assert.equal(parseTaskInput({ name: "旧接口任务" }).lookbackDays, 365);
  assert.throws(() => parseTaskInput({ name: "无效任务", taskType: "other" }));
  assert.throws(() => parseTaskInput({ name: "无效任务", cadence: "hourly" }));
});

test("真实结构的公开产品和需求列表生成固定原文链接，缺少可选字段仍可解析", () => {
  const products = parseOpcPage({ projects: [{ slug: "知识库-demo", name: "知识库", description: "面向企业的 RAG", createdAt: now.toISOString() }], pagination: { totalPages: 2 } }, "products");
  assert.equal(products.items[0]?.url, "https://www.opcquan.com/projects/%E7%9F%A5%E8%AF%86%E5%BA%93-demo");
  assert.equal(products.items[0]?.region, "");
  const demands = parseOpcPage({ data: [{ id: "demand-1", content: "供应知识库服务", title: "", createdAt: now.toISOString(), budgetMin: 8000 }], pagination: { totalPages: 1 } }, "demands");
  assert.equal(demands.items[0]?.title, "供应知识库服务");
  assert.equal(demands.items[0]?.url, "https://www.opcquan.com/plaza/demand-1");
  assert.match(demands.items[0]?.facts ?? "", /8000/);
  assert.throws(() => parseOpcPage({ data: [], pagination: {} }, "demands"));
  assert.throws(() => parseOpcPage({ projects: [{ slug: "../bad", createdAt: "bad" }], pagination: { totalPages: 1 } }, "products"));
});

test("公开请求限定固定端点、页码与超时，HTTP失败和格式错误会抛出", async () => {
  let requested = "";
  await fetchOpcPage("demands", 2, 1000, (async (url, init) => {
    requested = String(url);
    assert.equal(init?.redirect, "manual");
    assert.ok(init?.signal);
    return Response.json({ data: [], pagination: { totalPages: 2 } });
  }) as typeof fetch);
  assert.equal(requested, "https://www.opcquan.com/api/posts?type=DEMAND&page=2&limit=50");
  await assert.rejects(() => fetchOpcPage("products", 1, 1000, (async () => new Response("", { status: 302, headers: { location: "https://example.com" } })) as typeof fetch), /302/);
  await assert.rejects(() => fetchOpcPage("products", 1, 1000, (async () => new Response("", { status: 503 })) as typeof fetch), /503/);
  await assert.rejects(() => fetchOpcPage("products", 1, 1000, (async () => Response.json({ error: true })) as typeof fetch), /格式变化/);
});

test("翻过50条并按30天截断，未配置模型保留候选，再次执行只处理新增链接", async () => {
  const { database, sqlite } = migratedDatabase();
  const calls: string[] = [];
  const fetchPage = async (feed: OpcFeed, number: number) => {
    calls.push(`${feed}/${number}`);
    if (feed === "demands") return page([item(100, feed)]);
    if (number === 1) return page(Array.from({ length: 50 }, (_, index) => item(index)), 3);
    if (number === 2) return page([item(50), item(51, feed, "2026-09-01T00:00:00.000Z")], 3);
    return page([item(52, feed, "2026-09-01T00:00:00.000Z")], 3);
  };
  const first = await runOpcScan(database, { ...request, fetchPage, assess: null });
  assert.equal(first.collected, 52);
  assert.equal(first.pending, 52);
  assert.equal(first.status, "partial");
  assert.ok(calls.includes("products/2"));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM leads WHERE site='opcquan'").get()?.n, 0);
  const second = await runOpcScan(database, { ...request, fetchPage, assess });
  assert.equal(second.collected, 0);
  assert.equal(second.saved, 52);
  assert.equal(second.pending, 0);
  const third = await runOpcScan(database, { ...request, fetchPage, assess: async () => { throw new Error("must not rescore"); } });
  assert.equal(third.saved, 0);
  assert.equal(third.status, "done");
});

test("未完成分页跨执行续跑，某一feed失败不影响另一feed，模型失败后可重试", async () => {
  const { database, sqlite } = migratedDatabase();
  const first = await runOpcScan(database, { ...request, assess: async () => { throw new Error("timeout"); }, fetchPage: async (feed, number) => {
    if (feed === "demands" || number === 2) throw new Error("503");
    return page([item(1)], 2);
  } });
  assert.equal(first.status, "partial");
  assert.equal(first.pending, 1);
  assert.equal(sqlite.prepare("SELECT page FROM case_sync WHERE feed='products'").get()?.page, 2);
  const visited: string[] = [];
  const second = await runOpcScan(database, { ...request, assess, fetchPage: async (feed, number) => {
    visited.push(`${feed}/${number}`);
    return page([item(number === 2 ? 2 : 3, feed)], number === 2 ? 2 : 1);
  } });
  assert.deepEqual(visited, ["products/2", "demands/1"]);
  assert.equal(second.saved, 3);
  assert.equal(second.pending, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM case_sync").get()?.n, 0);
});

test("硬件低分不进入案例，需求区供给按模型side保存，不覆盖人工案例，Agent可增量读新案例", async () => {
  const { database, sqlite } = migratedDatabase();
  const manual = item(1);
  const supply = item(2, "demands");
  const hardware = item(3);
  sqlite.prepare("INSERT INTO leads (id,title,url,kind,origin,summary) VALUES (?, ?, ?, 'case', 'manual', ?)")
    .run("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "人工标题", manual.url, "人工摘要");
  const first = await runOpcScan(database, { ...request, fetchPage: async (feed) => page(feed === "products" ? [manual, hardware] : [supply]),
    assess: async (items) => new Map(items.map((value) => [value.url, assessment(value, value.url === hardware.url ? 10 : 85)])) });
  assert.equal(first.saved, 1);
  assert.equal(first.filtered, 1);
  assert.equal(sqlite.prepare("SELECT summary FROM leads WHERE url=?").get(manual.url)?.summary, "人工摘要");
  assert.equal(sqlite.prepare("SELECT side FROM leads WHERE url=?").get(supply.url)?.side, "supply");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM leads WHERE url=?").get(hardware.url)?.n, 0);
  const brief = await radarBrief(database, { since: "2026-11-13T00:00:00.000Z", limit: 50 });
  const card = brief.items.find((card) => card.url === supply.url);
  assert.equal(card?.kind, "case");
  assert.equal(card?.source_name, "OPC圈");
  assert.equal(card?.relevance_score, 85);
  assert.equal(card?.value_score, null);
  assert.match(card?.seen ?? "", /RAG/);
  const detail = await radarLead(database, { id: card?.id });
  assert.equal(detail.lead?.signal, "作者报价 8000 元");
  const after = await radarBrief(database, { since: brief.cursor?.created_at, after_id: brief.cursor?.id });
  assert.equal(after.items.length, 0);
});

test("并发执行被跳过且记录日志，不占用或释放别人的锁", async () => {
  const { database, sqlite } = migratedDatabase();
  sqlite.prepare("INSERT INTO collection_locks VALUES ('opc', 'other', ?)").run(Date.now() + 100000);
  const result = await runOpcScan(database, { ...request, fetchPage: async () => { throw new Error("must not fetch"); }, assess: null });
  assert.equal(result.status, "skipped");
  assert.equal(sqlite.prepare("SELECT token FROM collection_locks").get()?.token, "other");
  assert.equal(sqlite.prepare("SELECT status FROM crawl_jobs ORDER BY rowid DESC LIMIT 1").get()?.status, "skipped");
});

test("模型JSON按URL对应，拒绝未知赛道、缺少解读的高分和重复URL", () => {
  const sample = item(1);
  const valid = assessment(sample);
  assert.equal(parseCaseAssessments(JSON.stringify({ items: [valid] }), [sample], ["T01"]).get(sample.url)?.side, "supply");
  assert.equal(parseCaseAssessments(JSON.stringify({ items: [{ ...valid, tracks: ["T10"] }] }), [sample], ["T01"]).size, 0);
  assert.equal(parseCaseAssessments(JSON.stringify({ items: [{ ...valid, fit: "" }] }), [sample], ["T01"]).size, 0);
  assert.throws(() => parseCaseAssessments(JSON.stringify({ items: [valid, valid] }), [sample], ["T01"]));
});

test("任务一开始就写执行中记录，结束后原记录更新为最终结果", async () => {
  const { database, sqlite } = migratedDatabase();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const running = runOpcScan(database, { ...request, assess: null, fetchPage: async () => {
    entered();
    await gate;
    return page([]);
  } });
  try {
    await started;
    const log = sqlite.prepare("SELECT id, status, finished_at FROM crawl_jobs WHERE kind='opc_scan'").get();
    assert.equal(log?.status, "running", "采集等待期间，执行记录应已存在且显示执行中");
    assert.equal(log?.finished_at, null);
  } finally {
    release();
    await running;
  }
  const logs = sqlite.prepare("SELECT status, finished_at FROM crawl_jobs WHERE kind='opc_scan'").all();
  assert.equal(logs.length, 1, "开始和结束更新同一条记录");
  assert.equal(logs[0]?.status, "done");
  assert.ok(logs[0]?.finished_at);
});
