import { tasksDue } from "./collect";
import { runSourceScan } from "./source-scan";
import { listTasks } from "./tasks";

async function insertSkipped(database: D1Database, message: string): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO crawl_jobs (id, kind, status, message, started_at, finished_at)
       VALUES (?, 'task_run', 'skipped', ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), message, now, now)
    .run();
}

/** 到点后执行已启用、且周期匹配的任务。采集、筛选、入库与对话里的回看是同一套。 */
export async function runScheduledTasks(database: D1Database, cron: string): Promise<{ ran: number }> {
  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  try {
    tasks = await listTasks(database);
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取任务失败";
    await insertSkipped(database, `读取定时任务失败：${message}`);
    return { ran: 0 };
  }
  const due = tasksDue(
    cron,
    tasks.map((task) => ({ ...task, enabled: task.enabled === 1 })),
  );
  if (due.length === 0) {
    const message = tasks.length ? `这条 Cron（${cron}）没有到期的任务。` : "还没有定时任务。到任务页添加每天或每周一的回看。";
    await insertSkipped(database, message);
    console.log(JSON.stringify({ event: "cron_no_task", cron }));
    return { ran: 0 };
  }
  for (const task of due) {
    await runSourceScan(database, {
      lookbackDays: task.lookback_days,
      taskId: task.id,
      taskName: task.name,
      trigger: "schedule",
      instruction: task.instruction,
      budgetMs: 45_000,
    });
  }
  console.log(JSON.stringify({ event: "cron_tasks", cron, ran: due.length }));
  return { ran: due.length };
}
