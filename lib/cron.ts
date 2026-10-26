const WEEKLY = "0 1 * * 1";

export async function recordCronPlaceholder(database: D1Database, cron: string): Promise<{ id: string; kind: string }> {
  const kind = cron === WEEKLY ? "weekly_report" : "policy_scan";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const message =
    kind === "weekly_report"
      ? "周报 Cron 占位：已记录触发，尚未生成 Top3、demo 选题和开店话术。"
      : "政策巡检 Cron 占位：已记录触发，尚未自动抓取信源。可在信源页对单个列表试抓。";
  await database
    .prepare(
      `INSERT INTO crawl_jobs (id, kind, status, message, started_at, finished_at)
       VALUES (?, ?, 'placeholder', ?, ?, ?)`,
    )
    .bind(id, kind, message, now, now)
    .run();
  console.log(JSON.stringify({ event: "cron_placeholder", cron, kind, jobId: id }));
  return { id, kind };
}
