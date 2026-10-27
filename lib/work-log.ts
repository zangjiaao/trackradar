import type { CrawlJobRow } from "@/lib/domain";
import { getDb } from "@/lib/db";
import { clearCrawlJobs } from "@/lib/work-log-view";

export type { WorkLogItem } from "@/lib/work-log-view";
export { WORK_KIND_LABEL, WORK_STATUS_LABEL, formatWorkTime, presentWorkMessage } from "@/lib/work-log-view";

export type WorkRow = CrawlJobRow & {
  source_name: string | null;
  source_region: string | null;
  task_name: string | null;
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
              s.name AS source_name, s.region AS source_region,
              t.name AS task_name
       FROM crawl_jobs j
       LEFT JOIN sources s ON s.id = j.source_id
       LEFT JOIN agent_tasks t ON t.id = j.task_id
       ORDER BY j.created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<WorkRow>();
  return results;
}

/** 清空全部执行记录，不删除定时任务。 */
export async function clearWorkLog(): Promise<number> {
  return clearCrawlJobs(getDb());
}
