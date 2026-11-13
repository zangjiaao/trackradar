import { tasksDue } from "./collect";
import { runTask } from "./task-run";
import { listTasks } from "./tasks";

async function insertTaskNotice(database: D1Database, message: string, status = "skipped", taskId: string | null = null): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO crawl_jobs (id, task_id, kind, status, message, started_at, finished_at)
       VALUES (?, ?, 'task_run', ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), taskId, status, message, now, now)
    .run();
}

/** 到点后执行已启用、且周期匹配的任务。与任务页立即执行共用同一套采集、筛选和入库流程。 */
export async function runScheduledTasks(database: D1Database, cron: string): Promise<{ ran: number }> {
  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  try {
    tasks = await listTasks(database);
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取任务失败";
    await insertTaskNotice(database, `读取定时任务失败：${message}`);
    return { ran: 0 };
  }
  const due = tasksDue(
    cron,
    tasks.map((task) => ({ ...task, enabled: task.enabled === 1 })),
  );
  if (due.length === 0) {
    const message = tasks.length ? `这条 Cron（${cron}）没有到期的任务。` : "还没有定时任务。到任务页添加每天或每周一的回看。";
    await insertTaskNotice(database, message);
    console.log(JSON.stringify({ event: "cron_no_task", cron }));
    return { ran: 0 };
  }
  for (const task of due) {
    try {
      await runTask(database, { ...task, enabled: 1 }, "schedule");
    } catch {
      await insertTaskNotice(database, `任务「${task.name}」执行失败，其余到期任务继续执行。`, "failed", task.id);
    }
  }
  console.log(JSON.stringify({ event: "cron_tasks", cron, ran: due.length }));
  return { ran: due.length };
}
