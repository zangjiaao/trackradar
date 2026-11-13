import { RadarInputError, radarBrief, radarLead } from "./radar-read";

export async function radarPost(database: D1Database, kind: "brief" | "lead", request: Request) {
  const text = await request.text();
  if (text.length > 4000) return Response.json({ error: "请求太长。" }, { status: 400 });
  let input: unknown = {};
  if (text.trim()) {
    try {
      input = JSON.parse(text);
    } catch {
      return Response.json({ error: "看不懂参数。" }, { status: 400 });
    }
  }
  try {
    const body = kind === "brief" ? await radarBrief(database, input) : await radarLead(database, input);
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "没读成。";
    const status = error instanceof RadarInputError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
