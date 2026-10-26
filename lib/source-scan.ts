import type { SourceRow } from "@/lib/domain";
import { fetchPolicyList } from "@/lib/fetch-list";
import { writeLeadTracks } from "@/lib/lead-tracks";
import { loadTrackDictionaries } from "@/lib/queries";
import { fetchPolicyArticle } from "@/lib/fetch-article";
import { publishedDay } from "@/lib/lead-presentation";
import { readPolicy, type PolicyReading } from "@/lib/policy-read";
import { regionsInText, selectOpportunityItems } from "@/lib/source-window";
import { skeletonScores } from "@/lib/scoring";

const PER_SOURCE_LIMIT = 8;

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

async function saveLead(
  database: D1Database,
  source: SourceRow,
  item: { title: string; url: string; track: string; tracks: string[] },
  reading: PolicyReading,
): Promise<"saved" | "duplicate"> {
  const existing = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(item.url).first<{ id: string }>();
  if (existing) return "duplicate";
  const tracks = item.tracks.length ? item.tracks : [item.track];
  const scores = skeletonScores(item.title, tracks[0] ?? item.track);
  const id = crypto.randomUUID();
  await database
    .prepare(
      `INSERT INTO leads (
         id, source_id, track_code, title, url, summary, relevant_excerpt, opportunity_note, region, published_at,
         studio_angle, subsidy_note, participation_note, who_can_apply, contact_note, window_note,
         score_capability, score_funding, score_demand, score_policy, score_competition, score_demo, score_total, origin, kind
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agent', 'policy')`,
    )
    .bind(
      id,
      source.id,
      tracks[0] ?? item.track,
      item.title,
      item.url,
      reading.subsidyNote,
      reading.excerpt || null,
      reading.studioAngle,
      source.region,
      reading.publishedAt || publishedDay(item.title, item.url),
      reading.studioAngle,
      reading.subsidyNote,
      reading.participationNote,
      reading.whoCanApply,
      reading.contactNote,
      reading.windowNote,
      scores.capability,
      scores.funding_window,
      scores.demand_density,
      scores.policy_heat,
      scores.competition,
      scores.demo_feasibility,
      scores.total,
    )
    .run();
  await writeLeadTracks(database, id, tracks);
  return "saved";
}

/** 读已启用信源的列表页，筛出约一年内能映射到赛道的条目，写入机会清单，并逐条记下去过哪里。 */
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
      const page = await fetchList(source.list_url);
      fetched[index] = { source, items: page.items, error: page.error, skipped: false };
    }
  }
  if (sources.length > 0) {
    await Promise.all(Array.from({ length: Math.min(3, sources.length) }, () => worker()));
  }

  const details: ScanSourceResult[] = [];
  let savedTotal = 0;
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
    const selected = selectOpportunityItems(row.items, lookbackDays, now, dictionaries);
    let saved = 0;
    let duplicate = 0;
    let bodyReads = 0;
    for (const item of selected.keep.slice(0, PER_SOURCE_LIMIT)) {
      let reading = readPolicy(item.title, dictionaries);
      if (bodyReads < 4 && Date.now() < deadline - 9_000) {
        bodyReads += 1;
        const article = await fetchPolicyArticle(item.url);
        if (article && article.text.length > 180) {
          reading = readPolicy(`${item.title}\n${article.text}`, dictionaries);
          if (article.publishedAt) reading = { ...reading, publishedAt: article.publishedAt };
        }
      }
      const outcome = await saveLead(database, row.source, item, reading);
      if (outcome === "saved") saved += 1;
      else duplicate += 1;
    }
    savedTotal += saved;
    const message = [
      `${row.source.region}·${row.source.name}`,
      `回看 ${lookbackDays} 天`,
      `列表 ${row.items.length} 条`,
      `过期 ${selected.droppedOld}`,
      `排除 ${selected.droppedExcluded}`,
      `未映射 ${selected.droppedUnmapped}`,
      `过宽 ${selected.droppedBroad}`,
      `新写入 ${saved}`,
      duplicate ? `已有 ${duplicate}` : "",
      row.source.list_url,
    ]
      .filter(Boolean)
      .join("，");
    await insertJob(database, { kind: "source_scan", status: "done", message, sourceId: row.source.id, taskId: request.taskId });
    details.push({ sourceId: row.source.id, name: row.source.name, region: row.source.region, status: "done", fetched: row.items.length, saved, message });
  }

  const who = request.taskName ? `${triggerLabel(request.trigger)}「${request.taskName}」` : triggerLabel(request.trigger);
  const summary = sources.length
    ? `${who}｜回看 ${lookbackDays} 天｜访问 ${details.length} 个信源｜新写入 ${savedTotal} 条。能打开的通知会读正文，写下机会、福利、路径、门槛和联络人。过宽的不入库。不翻全站。`
    : `${who}｜没有可访问的启用信源${hints.length ? `（地域：${hints.join("、")}）` : ""}。先到配置里打开信源。`;
  const status = sources.length === 0 ? "skipped" : details.some((item) => item.status === "done") ? "done" : details.every((item) => item.status === "skipped") ? "skipped" : "failed";
  await insertJob(database, { kind: "task_run", status, message: summary, taskId: request.taskId });
  return { saved: savedTotal, visited: details.length, sources: details, summary };
}
