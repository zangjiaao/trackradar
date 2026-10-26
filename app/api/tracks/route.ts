import { saveTrack } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
    name?: unknown;
    summary?: unknown;
    studio_fit?: unknown;
    keywords?: unknown;
  } | null;
  if (!body || typeof body.code !== "string") return Response.json({ error: "需要赛道编号。" }, { status: 400 });
  try {
    await saveTrack({
      code: body.code,
      name: typeof body.name === "string" ? body.name : "",
      summary: typeof body.summary === "string" ? body.summary : "",
      studio_fit: typeof body.studio_fit === "string" ? body.studio_fit : "",
      keywords: typeof body.keywords === "string" ? body.keywords : "",
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存赛道失败";
    const status = /只能是|需要|找不到/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
