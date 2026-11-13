import { createAgentKey, listAgentKeys, revokeAgentKey } from "@/lib/agent-key";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ keys: await listAgentKeys(getDb()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "没读到钥匙。";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  try {
    const created = await createAgentKey(getDb(), body?.name);
    return Response.json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "没建成钥匙。";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  try {
    await revokeAgentKey(getDb(), body?.id);
    return Response.json({ keys: await listAgentKeys(getDb()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "没作废。";
    return Response.json({ error: message }, { status: 400 });
  }
}
