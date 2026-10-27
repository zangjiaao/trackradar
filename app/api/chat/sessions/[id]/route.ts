import { chatSessionErrorStatus } from "@/lib/chat-memory";
import { getDb } from "@/lib/db";
import { deleteChatSession, getChatSession, saveChatSession } from "@/lib/chat-sessions";

export const dynamic = "force-dynamic";

type SessionRouteContext = { params: Promise<{ id: string }> };

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: chatSessionErrorStatus(message) });
}

export async function GET(_request: Request, context: SessionRouteContext) {
  try {
    const { id } = await context.params;
    const session = await getChatSession(getDb(), id);
    if (!session) return Response.json({ error: "找不到这个会话。" }, { status: 404 });
    return Response.json({ session });
  } catch (error) {
    return fail(error, "读取会话失败");
  }
}

export async function PUT(request: Request, context: SessionRouteContext) {
  const body = (await request.json().catch(() => null)) as { messages?: unknown; draft?: unknown } | null;
  if (!body || typeof body !== "object") return Response.json({ error: "需要 JSON 请求体。" }, { status: 400 });
  try {
    const { id } = await context.params;
    const session = await saveChatSession(getDb(), id, body);
    return Response.json({ session });
  } catch (error) {
    return fail(error, "保存会话失败");
  }
}

export async function DELETE(_request: Request, context: SessionRouteContext) {
  try {
    const { id } = await context.params;
    await deleteChatSession(getDb(), id);
    return Response.json({ ok: true });
  } catch (error) {
    return fail(error, "删除会话失败");
  }
}
