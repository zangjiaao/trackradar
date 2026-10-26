import { suggestOpportunity } from "@/lib/suggest-opportunity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (title.length < 2) return Response.json({ error: "请先写标题，至少两个字。" }, { status: 400 });
  try {
    const suggestion = await suggestOpportunity({
      title,
      notes: typeof body?.notes === "string" ? body.notes : "",
      site: typeof body?.site === "string" ? body.site : "",
      region: typeof body?.region === "string" ? body.region : "",
      url: typeof body?.url === "string" ? body.url : "",
    });
    return Response.json({ suggestion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "补全失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
