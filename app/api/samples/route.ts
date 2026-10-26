import { parsePastedSamples } from "@/lib/parse-sample";
import { insertSamples, listSamples, normalizeSampleDrafts } from "@/lib/queries";
import { isPlatform, isSide } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ samples: await listSamples() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取采样失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string; text?: string; platform?: string; keyword?: string; side?: string; items?: unknown }
    | null;
  if (!body) return Response.json({ error: "无法解析请求。" }, { status: 400 });

  try {
    if (body.action === "parse") {
      const text = typeof body.text === "string" ? body.text : "";
      if (text.trim().length < 4) return Response.json({ error: "请先粘贴搜索结果或选中文本。" }, { status: 400 });
      const items = parsePastedSamples(text).map((item) => ({
        ...item,
        platform: isPlatform(body.platform ?? "") ? body.platform : "xianyu",
        keyword: typeof body.keyword === "string" ? body.keyword.trim() : "",
        side: isSide(body.side ?? "") ? body.side : "demand",
      }));
      if (items.length === 0) {
        return Response.json({ error: "没有抽出标题和链接。请包含 http(s) 链接，或使用 Markdown / 网页锚点。" }, { status: 422 });
      }
      return Response.json({ items });
    }

    const saved = await insertSamples(normalizeSampleDrafts(body.items));
    return Response.json({ saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
