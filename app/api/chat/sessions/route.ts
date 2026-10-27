import { chatSessionErrorStatus } from "@/lib/chat-memory";
import { getDb } from "@/lib/db";
import { createChatSession, listChatSessions } from "@/lib/chat-sessions";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: chatSessionErrorStatus(message) });
}

export async function GET() {
  try {
    return Response.json({ sessions: await listChatSessions(getDb()) });
  } catch (error) {
    return fail(error, "读取会话失败");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { messages?: unknown; draft?: unknown } | null;
  const input = body && typeof body === "object" ? body : {};
  try {
    const session = await createChatSession(getDb(), input);
    return Response.json({ session });
  } catch (error) {
    return fail(error, "新建会话失败");
  }
}
