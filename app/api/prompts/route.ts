import { getActivePrompt, saveActivePrompt } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prompt = await getActivePrompt();
    if (!prompt) return Response.json({ error: "没有激活的提示词。请先执行数据库迁移。" }, { status: 404 });
    return Response.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取提示词失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { system_prompt?: string } | null;
  if (!body || typeof body.system_prompt !== "string") {
    return Response.json({ error: "需要 system_prompt。" }, { status: 400 });
  }
  try {
    await saveActivePrompt(body.system_prompt);
    const prompt = await getActivePrompt();
    return Response.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存提示词失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
