import { isCadence } from "@/lib/collect";
import { readCollectConfig, readPublicModel, saveCollectSettings, saveModelSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [model, collect] = await Promise.all([readPublicModel(), readCollectConfig()]);
    return Response.json({ model, collect });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取配置失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    apiKey?: unknown;
    clearKey?: unknown;
    baseURL?: unknown;
    model?: unknown;
    collectEnabled?: unknown;
    cadence?: unknown;
  } | null;
  if (!body) return Response.json({ error: "需要 JSON 请求体。" }, { status: 400 });
  try {
    const touchesModel = "apiKey" in body || "clearKey" in body || "baseURL" in body || "model" in body;
    if (touchesModel) {
      await saveModelSettings({
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        clearKey: body.clearKey === true,
        baseURL: typeof body.baseURL === "string" ? body.baseURL : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
      });
    }
    if ("collectEnabled" in body || "cadence" in body) {
      const current = await readCollectConfig();
      const cadence = typeof body.cadence === "string" && isCadence(body.cadence) ? body.cadence : current.cadence;
      const enabled = typeof body.collectEnabled === "boolean" ? body.collectEnabled : current.enabled;
      if (typeof body.cadence === "string" && !isCadence(body.cadence)) {
        return Response.json({ error: "周期只能是每天或每周一。" }, { status: 400 });
      }
      await saveCollectSettings({ enabled, cadence });
    }
    const [model, collect] = await Promise.all([readPublicModel(), readCollectConfig()]);
    return Response.json({ model, collect });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存配置失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
