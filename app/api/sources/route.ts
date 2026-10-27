import { setSourceEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; enabled?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.enabled !== "boolean") {
    return Response.json({ error: "需要 id 和 enabled。" }, { status: 400 });
  }
  try {
    await setSourceEnabled(body.id, body.enabled);
    return Response.json({ id: body.id, enabled: body.enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新信源失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
