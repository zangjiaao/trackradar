import { fetchSourcePreview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string; save?: boolean } | null;
  if (!body?.id) return Response.json({ error: "需要信源 id。" }, { status: 400 });
  try {
    const result = await fetchSourcePreview(body.id, Boolean(body.save));
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
