import { deleteTask, createTask, listTasks, parseTaskInput, setTaskEnabled } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ tasks: await listTasks() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取任务失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "需要 JSON 请求体。" }, { status: 400 });
  try {
    const task = await createTask(parseTaskInput(body));
    return Response.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加任务失败";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; enabled?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.enabled !== "boolean") {
    return Response.json({ error: "需要任务 id 和启用状态。" }, { status: 400 });
  }
  try {
    await setTaskEnabled(body.id, body.enabled);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新任务失败";
    const status = message.includes("找不到") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string") return Response.json({ error: "需要任务 id。" }, { status: 400 });
  try {
    await deleteTask(body.id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除任务失败";
    const status = message.includes("找不到") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
