import { cadenceLabel, collectFromMap, decideCron, type Cadence } from "./collect";

async function readCollect(database: D1Database): Promise<{ enabled: boolean; cadence: Cadence }> {
  try {
    const { results } = await database
      .prepare("SELECT key, value FROM app_settings WHERE key IN ('collect_enabled', 'collect_cadence')")
      .all<{ key: string; value: string }>();
    const map: Record<string, string> = {};
    for (const row of results) map[row.key] = row.value;
    return collectFromMap(map);
  } catch {
    return { enabled: true, cadence: "daily" };
  }
}

export async function recordCronPlaceholder(database: D1Database, cron: string): Promise<{ id: string; kind: string; status: string }> {
  const collect = await readCollect(database);
  const decision = decideCron(cron, collect);
  const kind = collect.cadence === "weekly" ? "weekly_report" : "policy_scan";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const period = cadenceLabel(collect.cadence);
  const message = !collect.enabled
    ? "采集已在配置里关闭，这次触发只记跳过，没有抓取。"
    : decision === "skip"
      ? `当前周期是${period}，这条 Cron（${cron}）不在周期内，只记跳过。`
      : kind === "weekly_report"
        ? `周报占位：按配置的${period}触发，尚未生成 Top3。可在配置页对启用信源试抓。`
        : `政策巡检占位：按配置的${period}触发，尚未自动抓取。可在配置页对启用信源试抓并写入机会清单。`;
  const status = decision === "run" ? "placeholder" : "skipped";
  await database
    .prepare(
      `INSERT INTO crawl_jobs (id, kind, status, message, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, kind, status, message, now, now)
    .run();
  console.log(JSON.stringify({ event: "cron_placeholder", cron, kind, status, jobId: id }));
  return { id, kind, status };
}
