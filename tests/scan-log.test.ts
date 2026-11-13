import assert from "node:assert/strict";
import test from "node:test";
import { migratedDatabase } from "./helpers/d1.ts";
import { withScanLog } from "../lib/scan-log.ts";
import { clearCrawlJobs } from "../lib/work-log-view.ts";
import { runOpcScan } from "../lib/opc-scan.ts";

test("进度持久化，清空记录保留执行中的记录，完成后同一记录可清空", async () => {
  const { database, sqlite } = migratedDatabase();
  sqlite.exec("INSERT INTO crawl_jobs (id,kind,status,message) VALUES ('old','task_run','done','已结束')");
  let id: string | undefined;
  const result = await withScanLog(database, { title: "采集测试", kind: "task_run", taskId: "opcquan-daily" }, async (progress) => {
    const initial = sqlite.prepare("SELECT id,task_id,status,finished_at FROM crawl_jobs WHERE status='running'").get();
    id = initial?.id as string;
    assert.equal(initial?.task_id, "opcquan-daily");
    assert.equal(initial?.finished_at, null);
    await progress("访问 3 页，写入案例 2");
    assert.match(String(sqlite.prepare("SELECT message FROM crawl_jobs WHERE id=?").get(id)?.message), /写入案例 2/);
    assert.equal(await clearCrawlJobs(database), 1);
    assert.equal(sqlite.prepare("SELECT status FROM crawl_jobs WHERE id=?").get(id)?.status, "running");
    return { status: "partial" as const, summary: "还有候选待筛选" };
  });
  assert.equal(result.status, "partial");
  const final = sqlite.prepare("SELECT status,message,finished_at FROM crawl_jobs WHERE id=?").get(id!);
  assert.equal(final?.status, "partial");
  assert.equal(final?.message, "还有候选待筛选");
  assert.ok(final?.finished_at);
  assert.equal(await clearCrawlJobs(database), 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM crawl_jobs").get()?.n, 0);
});

test("启动阶段抛出异常也留下失败记录，而不是直接跳过日志", async () => {
  const { database, sqlite } = migratedDatabase();
  const broken = {
    prepare(sql: string) {
      if (sql.includes("collection_locks")) throw new Error("injected lock error");
      return database.prepare(sql);
    },
  } as D1Database;
  await assert.rejects(() => runOpcScan(broken, { trigger: "manual", taskId: "opcquan-daily", lookbackDays: 30, assess: null }), /injected/);
  const logs = sqlite.prepare("SELECT status,finished_at,message FROM crawl_jobs WHERE kind='opc_scan'").all();
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.status, "failed");
  assert.ok(logs[0]?.finished_at);
  assert.doesNotMatch(String(logs[0]?.message), /injected lock error/);
});
