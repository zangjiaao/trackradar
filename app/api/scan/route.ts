import { getDb } from "@/lib/db";
import { runSourceScan } from "@/lib/source-scan";
import { normalizeLookback } from "@/lib/source-window";
import { runTask } from "@/lib/task-run";
import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "需要 JSON 请求体。" }, { status: 400 });
  try {
    const database = getDb();
    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    const task = taskId ? await getTask(taskId, database) : null;
    if (taskId && !task) return Response.json({ error: "找不到这个任务。" }, { status: 404 });
    const result = task ? await runTask(database, task, "manual") : await runSourceScan(database, {
      lookbackDays: normalizeLookback(body.lookbackDays),
      taskId: null,
      taskName: null,
      trigger: "manual",
      region: typeof body.region === "string" ? body.region : null,
      instruction: (typeof body.instruction === "string" ? body.instruction : null),
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "回看信源失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
