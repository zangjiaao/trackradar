import { getDb } from "@/lib/db";
import { rereadLeads } from "@/lib/reread-leads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown; limit?: unknown } | null;
  try {
    const result = await rereadLeads(getDb(), {
      url: typeof body?.url === "string" ? body.url : null,
      limit: typeof body?.limit === "number" ? body.limit : undefined,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新解读失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
