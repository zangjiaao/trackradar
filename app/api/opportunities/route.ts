import { saveOpportunity } from "@/lib/opportunities";
import type { ScoreParts } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function isScores(value: unknown): value is Partial<ScoreParts> {
  return Boolean(value) && typeof value === "object";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "需要 JSON 请求体。" }, { status: 400 });
  try {
    const saved = await saveOpportunity(
      {
        title: typeof body.title === "string" ? body.title : "",
        url: typeof body.url === "string" ? body.url : "",
        site: typeof body.site === "string" ? body.site : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        region: "region" in body && typeof body.region === "string" ? body.region : undefined,
        track_code: "track_code" in body ? (typeof body.track_code === "string" ? body.track_code : null) : undefined,
        side: "side" in body ? (typeof body.side === "string" ? body.side : null) : undefined,
        summary: "summary" in body ? (typeof body.summary === "string" ? body.summary : null) : undefined,
        scores: isScores(body.scores) ? body.scores : undefined,
      },
      "manual_entry",
    );
    return Response.json({ id: saved.id, lead: saved.lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "写入机会失败";
    const status = /已经在机会清单|请填写|链接需要/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
