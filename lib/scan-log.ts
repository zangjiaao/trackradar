/** A scan has a persisted record before any network or model work starts. */
export type ScanProgress = (message: string) => Promise<void>;
export type ScanStatus = "done" | "partial" | "failed" | "skipped";

export async function withScanLog<T extends { status: ScanStatus; summary: string }>(
  database: D1Database,
  input: { kind: string; title: string; taskId?: string | null },
  run: (progress: ScanProgress) => Promise<T>,
): Promise<T> {
  const id = crypto.randomUUID();
  const started = new Date().toISOString();
  await database.prepare(`INSERT INTO crawl_jobs (id, task_id, kind, status, message, started_at)
    VALUES (?, ?, ?, 'running', ?, ?)`)
    .bind(id, input.taskId ?? null, input.kind, `${input.title}｜正在准备采集`, started).run();
  const progress: ScanProgress = async (message) => {
    await database.prepare("UPDATE crawl_jobs SET message = ? WHERE id = ? AND status = 'running'")
      .bind(`${input.title}｜${message}`, id).run();
  };
  try {
    const result = await run(progress);
    await database.prepare("UPDATE crawl_jobs SET status = ?, message = ?, finished_at = ? WHERE id = ? AND status = 'running'")
      .bind(result.status, result.summary, new Date().toISOString(), id).run();
    return result;
  } catch (error) {
    await database.prepare("UPDATE crawl_jobs SET status = 'failed', message = ?, finished_at = ? WHERE id = ? AND status = 'running'")
      .bind(`${input.title}｜执行失败，已保存的候选保留，请检查配置后重试。`, new Date().toISOString(), id).run();
    throw error;
  }
}
