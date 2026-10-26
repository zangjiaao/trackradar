import type { CrawlJobRow } from "@/lib/domain";
import { getDb } from "@/lib/db";

export type WorkRow = CrawlJobRow & {
  source_name: string | null;
  source_region: string | null;
};

export const WORK_KIND_LABEL: Record<string, string> = {
  policy_scan: "政策巡检",
  weekly_report: "周报",
  manual_fetch: "信源试抓",
  tool_list_tracks: "查看赛道",
  tool_list_leads: "查看机会",
  tool_search_sources: "查询信源",
  tool_suggest_opportunity: "补全素材",
  manual_entry: "录入机会",
  tool_add_opportunity: "对话写入机会",
};

export const WORK_STATUS_LABEL: Record<string, string> = {
  placeholder: "占位",
  skipped: "跳过",
  done: "完成",
  failed: "失败",
};

export async function recordWork(input: { kind: string; status: string; message: string; sourceId?: string | null }): Promise<void> {
  try {
    const now = new Date().toISOString();
    await getDb()
      .prepare(
        `INSERT INTO crawl_jobs (id, source_id, kind, status, message, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), input.sourceId ?? null, input.kind, input.status, input.message.slice(0, 500), now, now)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "写入工作记录失败";
    console.log(JSON.stringify({ event: "work_log_failed", message }));
  }
}

export async function listWork(limit = 80): Promise<WorkRow[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT j.id, j.source_id, j.kind, j.status, j.message, j.created_at,
              s.name AS source_name, s.region AS source_region
       FROM crawl_jobs j
       LEFT JOIN sources s ON s.id = j.source_id
       ORDER BY j.created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<WorkRow>();
  return results;
}
