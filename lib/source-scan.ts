import type { SourceRow } from "@/lib/domain";
import { fetchPolicyList } from "@/lib/fetch-list";
import { formatScanSourceMessage } from "@/lib/policy-collect";
import { ingestPolicyList } from "@/lib/policy-ingest";
import { loadTrackDictionaries } from "@/lib/queries";
import { regionsInText } from "@/lib/source-window";

export type ScanTrigger = "chat" | "schedule" | "manual";

export type ScanRequest = {
  lookbackDays: number;
  taskId?: string | null;
  taskName?: string | null;
  trigger: ScanTrigger;
  region?: string | null;
  instruction?: string | null;
  budgetMs?: number;
  now?: Date;
  fetchList?: typeof fetchPolicyList;
};

export type ScanSourceResult = {
  sourceId: string;
  name: string;
  region: string;
  status: "done" | "failed" | "skipped";
  fetched: number;
  saved: number;
  message: string;
};

export type ScanResult = {
  saved: number;
  visited: number;
  sources: ScanSourceResult[];
  summary: string;
};

function triggerLabel(trigger: ScanTrigger): string {
  if (trigger === "schedule") return "定时执行";
  if (trigger === "manual") return "立即执行";
  return "对话触发";
}

function sourceMatches(source: SourceRow, hints: string[]): boolean {
  if (hints.length === 0) return true;
  const blob = `${source.region} ${source.name} ${source.notes ?? ""}`;
  return hints.some((hint) => blob.includes(hint) || hint.includes(source.region));
}

async function insertJob(
  database: D1Database,
  input: { kind: string; status: string; message: string; sourceId?: string | null; taskId?: string | null },
): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO crawl_jobs (id, source_id, task_id, kind, status, message, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), input.sourceId ?? null, input.taskId ?? null, input.kind, input.status, input.message.slice(0, 500), now, now)
    .run();
}

/** 读已启用信源的列表页。先采集入库，再评分、过滤，只解读留下的政策。 */
export async function runSourceScan(database: D1Database, request: ScanRequest): Promise<ScanResult> {
  const lookbackDays = request.lookbackDays;
  const now = request.now ?? new Date();
  const fetchList = request.fetchList ?? fetchPolicyList;
  const hints = [...new Set([...regionsInText(request.region), ...regionsInText(request.instruction)])];
  const dictionaries = await loadTrackDictionaries(database);
  const { results } = await database
    .prepare("SELECT id, region, name, list_url, adapter, enabled, notes FROM sources WHERE enabled = 1 ORDER BY region, name")
    .all<SourceRow>();
  const sources = results.filter((source) => sourceMatches(source, hints));
  const deadline = Date.now() + (request.budgetMs ?? 55_000);
  const fetched: Array<{ source: SourceRow; items: { title: string; url: string }[]; error?: string; skipped: boolean }> = new Array(sources.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const index = cursor;
      cursor += 1;
      const source = sources[index];
      if (!source) return;
      if (Date.now() > deadline) {
        fetched[index] = { source, items: [], error: "本轮时间用尽，未访问", skipped: true };
        continue;
      }
      const page = await fetchList(source.list_url, { lookbackDays, now, deadline });
      fetched[index] = { source, items: page.items, error: page.error, skipped: false };
    }
  }
  if (sources.length > 0) {
    await Promise.all(Array.from({ length: Math.min(3, sources.length) }, () => worker()));
  }

  const details: ScanSourceResult[] = [];
  let savedTotal = 0;
  let collectedTotal = 0;
  let scoredTotal = 0;
  let filteredTotal = 0;
  for (const row of fetched) {
    if (!row) continue;
    if (row.skipped) {
      const message = `${row.source.region}·${row.source.name}：${row.error}`;
      await insertJob(database, { kind: "source_scan", status: "skipped", message, sourceId: row.source.id, taskId: request.taskId });
      details.push({ sourceId: row.source.id, name: row.source.name, region: row.source.region, status: "skipped", fetched: 0, saved: 0, message });
      continue;
    }
    if (row.error) {
      const message = `${row.source.region}·${row.source.name}：${row.error}。列表 ${row.source.list_url}`;
      await insertJob(database, { kind: "source_scan", status: "failed", message, sourceId: row.source.id, taskId: request.taskId });
      details.push({ sourceId: row.source.id, name: row.source.name, region: row.source.region, status: "failed", fetched: 0, saved: 0, message });
      continue;
    }
    const tally = await ingestPolicyList({
      database,
      source: row.source,
      items: row.items,
      lookbackDays,
      now,
      dictionaries,
      deadline,
      origin: "agent",
    });
    savedTotal += tally.interpreted;
    collectedTotal += tally.collected;
    scoredTotal += tally.scored;
    filteredTotal += tally.filtered;
    const message = formatScanSourceMessage(row.source.region, row.source.name, tally);
    await insertJob(database, { kind: "source_scan", status: "done", message, sourceId: row.source.id, taskId: request.taskId });
    details.push({
      sourceId: row.source.id,
      name: row.source.name,
      region: row.source.region,
      status: "done",
      fetched: row.items.length,
      saved: tally.interpreted,
      message,
    });
  }

  const who = request.taskName ? `${triggerLabel(request.trigger)}「${request.taskName}」` : triggerLabel(request.trigger);
  const summary = sources.length
    ? `${who}｜回看 ${lookbackDays} 天｜访问 ${details.length} 个信源｜采集 ${collectedTotal}，评了 ${scoredTotal}，低分过滤 ${filteredTotal}，解读写入 ${savedTotal}。候选先入库。列表会翻到回看窗口内的后续页。有模型时读正文判断是否与工作室有关，并写一段解读；无关的不进入政策页。没有模型时不写入政策页。`
    : `${who}｜没有可访问的启用信源${hints.length ? `（地域：${hints.join("、")}）` : ""}。先到配置里打开信源。`;
  const status = sources.length === 0 ? "skipped" : details.some((item) => item.status === "done") ? "done" : details.every((item) => item.status === "skipped") ? "skipped" : "failed";
  await insertJob(database, { kind: "task_run", status, message: summary, taskId: request.taskId });
  return { saved: savedTotal, visited: details.length, sources: details, summary };
}
