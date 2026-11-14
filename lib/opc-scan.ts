import { opcAuthorStatements } from "./case-author";
import { withScanLog, type ScanProgress, type ScanStatus } from "./scan-log";
import type { CaseAssessor, CaseAssessment } from "./case-assess";
import { assessErrorReason } from "./policy-assess-json";
import { fetchOpcPage, opcFetchErrorReason, type OpcFeed, type OpcItem } from "./opc-feed";

export type OpcScanRequest = {
  taskId?: string | null;
  taskName?: string | null;
  trigger: "manual" | "schedule";
  lookbackDays: number;
  instruction?: string | null;
  budgetMs?: number;
  now?: Date;
  fetchPage?: typeof fetchOpcPage;
  /** Explicit null disables the model. Injection keeps integration tests offline. */
  assess?: CaseAssessor | null;
};

type Pending = { url: string; payload: string };
const FEEDS: OpcFeed[] = ["products", "demands"];

async function saveAssessment(database: D1Database, item: OpcItem, assessment: CaseAssessment) {
  const now = new Date().toISOString();
  if (assessment.score < 50) {
    await database.prepare("UPDATE case_candidates SET stage = 'dropped', relevance_score = ?, relevance_reason = ?, updated_at = ? WHERE url = ? AND stage = 'raw'")
      .bind(assessment.score, assessment.reason, now, item.url).run();
    return false;
  }
  const id = crypto.randomUUID();
  // D1 batch is transactional. The conditional insert plus queue lock prevents
  // duplicate automated writes; an existing manually entered URL is preserved.
  const result = await database.batch([
    database.prepare(`INSERT INTO leads (id, title, url, summary, opportunity_note, region, side, site, signal, published_at, track_code, origin, kind)
      SELECT ?, ?, ?, ?, ?, ?, ?, 'opcquan', ?, ?, ?, 'agent', 'case'
      WHERE EXISTS (SELECT 1 FROM case_candidates WHERE url = ? AND stage = 'raw')
        AND NOT EXISTS (SELECT 1 FROM leads WHERE url = ?)`)
      .bind(id, item.title, item.url, assessment.summary, assessment.fit, item.region || null, assessment.side,
        assessment.signal || null, item.publishedAt.slice(0, 10), assessment.tracks[0], item.url, item.url),
    ...assessment.tracks.map((code) => database.prepare(`INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
      SELECT id, ? FROM leads WHERE id = ?`).bind(code, id)),
    database.prepare(`UPDATE case_candidates SET stage = 'interpreted', relevance_score = ?, relevance_reason = ?,
      lead_id = (SELECT id FROM leads WHERE url = ? ORDER BY created_at, id LIMIT 1), updated_at = ? WHERE url = ? AND stage = 'raw'`)
      .bind(assessment.score, assessment.reason, item.url, now, item.url),
  ]);
  return (result[0]?.meta.changes ?? 0) > 0;
}

/** Shared manual/cron pipeline, with durable pagination and a retryable candidate queue. */
export function runOpcScan(database: D1Database, request: OpcScanRequest) {
  const title = `${request.trigger === "schedule" ? "定时执行" : "立即执行"}「${request.taskName ?? "OPC 案例采集"}」`;
  return withScanLog(database, { kind: "opc_scan", title, taskId: request.taskId }, (progress) => scanOpc(database, request, progress));
}

async function scanOpc(database: D1Database, request: OpcScanRequest, progress: ScanProgress) {
  const deadline = Date.now() + (request.budgetMs ?? 90_000);
  const token = crypto.randomUUID();
  const lock = await database.prepare(`INSERT INTO collection_locks (name, token, expires_at) VALUES ('opc', ?, ?)
    ON CONFLICT(name) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at WHERE collection_locks.expires_at < ?`)
    .bind(token, deadline + 30_000, Date.now()).run();
  let saved = 0;
  let collected = 0;
  let scored = 0;
  let filtered = 0;
  let visited = 0;
  let pending = 0;
  let status: ScanStatus = "done";
  const notes: string[] = [];
  const acquired = (lock.meta.changes ?? 0) > 0;
  try {
    if (!acquired) {
      status = "skipped";
      notes.push("已有 OPC 采集执行中，请稍后重试");
    } else {
      const fetchPage = request.fetchPage ?? fetchOpcPage;
      const now = request.now ?? new Date();
      const cutoff = new Date(now.getTime() - request.lookbackDays * 86_400_000).toISOString();
      const fetchDeadline = Math.min(deadline, Date.now() + 25_000);
      // Interleave feeds so a long products backlog cannot starve demand collection.
      const states = await Promise.all(FEEDS.map(async (feed) => {
        const prior = await database.prepare("SELECT page, cutoff FROM case_sync WHERE feed = ?").bind(feed).first<{ page: number; cutoff: string }>();
        return { feed, page: prior?.page ?? 1, cutoff: prior?.cutoff ?? cutoff, done: false };
      }));
      for (let round = 0; round < 20 && states.some((state) => !state.done); round += 1) {
        for (const state of states) {
          if (state.done) continue;
          if (Date.now() + 1000 >= fetchDeadline) break;
          try {
            const page = await fetchPage(state.feed, state.page, Math.max(1, Math.min(8000, fetchDeadline - Date.now())));
            visited += 1;
            const items = page.items.filter((item) => item.publishedAt >= state.cutoff && item.publishedAt <= now.toISOString());
            if (items.length) {
              const inserts = await database.batch([
                ...items.map((item) => database.prepare(
                  "INSERT OR IGNORE INTO case_candidates (url, feed, payload) VALUES (?, ?, ?)",
                ).bind(item.url, item.feed, JSON.stringify(item))),
                ...items.flatMap((item) => opcAuthorStatements(database, item)),
              ]);
              collected += inserts.slice(0, items.length).reduce((total, result) => total + (result.meta.changes ?? 0), 0);
            }
            await progress(`正在采集${state.feed === "products" ? "产品" : "需求"}｜访问 ${visited} 页，新增候选 ${collected}`);
            // Pinned demand posts can mix dates. Do not stop at the first old item.
            state.done = state.page >= page.totalPages || page.items.length === 0
              || page.items.every((item) => item.publishedAt < state.cutoff);
            state.page += 1;
            if (state.done) await database.prepare("DELETE FROM case_sync WHERE feed = ?").bind(state.feed).run();
            else await database.prepare(`INSERT INTO case_sync (feed, page, cutoff, updated_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(feed) DO UPDATE SET page = excluded.page, cutoff = excluded.cutoff, updated_at = excluded.updated_at`)
              .bind(state.feed, state.page, state.cutoff, new Date().toISOString()).run();
          } catch (error) {
            notes.push(`${state.feed === "products" ? "产品" : "需求"}列表获取失败（${opcFetchErrorReason(error)}），页码保留，下次重试`);
            status = "partial";
            // Stop this feed only, while letting the other feed progress.
            state.done = true;
          }
        }
        if (Date.now() + 1000 >= fetchDeadline) break;
      }
      if (states.some((state) => !state.done)) { notes.push("列表尚未采完，下次从保存的页码继续"); status = "partial"; }
      await progress(`列表采集阶段结束｜访问 ${visited} 页，新增候选 ${collected}｜正在准备筛选`);
      const assess = request.assess !== undefined ? request.assess
        : await (await import("./case-assess-model")).createCaseAssessor(database, request.instruction ?? "");
      if (!assess) notes.push("未配置模型，候选已保留，配置后再次执行可继续筛选");
      else {
        const { results: queue } = await database.prepare(`SELECT url, payload FROM case_candidates WHERE stage = 'raw'
          ORDER BY attempts ASC, created_at ASC, url ASC LIMIT 160`).all<Pending>();
        // Small batches bound token counts. Failed/incomplete results remain raw.
        for (let offset = 0; offset < queue.length && Date.now() + 2000 < deadline; offset += 8) {
          const batch = queue.slice(offset, offset + 8);
          await database.batch(batch.map((row) => database.prepare("UPDATE case_candidates SET attempts = attempts + 1 WHERE url = ?").bind(row.url)));
          await progress(`正在筛选候选｜新增候选 ${collected}，评了 ${scored}，过滤 ${filtered}，写入案例 ${saved}`);
          try {
            const items = batch.map((row) => JSON.parse(row.payload) as OpcItem);
            const results = await assess(items, Math.max(1, Math.min(25_000, deadline - Date.now())));
            for (const item of items) {
              const value = results.get(item.url);
              if (!value) continue;
              if (await saveAssessment(database, item, value)) saved += 1;
              scored += 1;
              if (value.score < 50) filtered += 1;
            }
            await progress(`正在筛选候选｜新增候选 ${collected}，评了 ${scored}，过滤 ${filtered}，写入案例 ${saved}`);
          } catch (error) {
            notes.push(`筛选未完成（${assessErrorReason(error)}），未处理候选保留待重试`);
            status = "partial";
            break;
          }
        }
      }
      pending = (await database.prepare("SELECT COUNT(*) AS total FROM case_candidates WHERE stage = 'raw'").first<{ total: number }>())?.total ?? 0;
      if (pending > 0) { status = "partial"; notes.push("仍有待筛选候选，可立即执行继续处理"); }
    }
  } catch {
    status = "failed";
    notes.push("采集流程失败，已入库候选保留，请查看配置后重试");
  } finally {
    if (acquired) await database.prepare("DELETE FROM collection_locks WHERE name = 'opc' AND token = ?").bind(token).run();
  }
  const summary = `${request.trigger === "schedule" ? "定时执行" : "立即执行"}「${request.taskName ?? "OPC 案例采集"}」｜访问 ${visited} 页｜新增候选 ${collected}，评了 ${scored}，过滤 ${filtered}，写入案例 ${saved}，待筛选 ${pending}。${[...new Set(notes)].join("；")}`;
  return { saved, collected, scored, filtered, pending, visited, status, summary };
}
