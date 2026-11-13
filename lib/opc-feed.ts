import type { CaseAuthor } from "./domain";

/** OPC圈 public feeds. Only these fixed endpoints are fetched, never links in posts. */
export type OpcFeed = "products" | "demands";
export type OpcItem = {
  url: string;
  feed: OpcFeed;
  title: string;
  body: string;
  publishedAt: string;
  region: string;
  facts: string;
  /** Missing on legacy candidate payloads. Never inferred by the model. */
  author?: CaseAuthor | null;
};
export type OpcPage = { items: OpcItem[]; totalPages: number; oldest: string | null };

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 16000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function opcProfileUrl(username: string | null): string | null {
  return username ? `https://www.opcquan.com/profile/${encodeURIComponent(username)}` : null;
}

function parseAuthor(value: unknown): CaseAuthor | null {
  const row = record(value);
  const id = text(row.id, 200);
  if (!id) return null;
  const username = text(row.username, 200) || null;
  return {
    id, username, name: text(row.name, 200) || null, bio: text(row.bio, 2000) || null,
    location: text(row.location, 100) || null,
    verified: typeof row.verified === "boolean" ? row.verified : null,
    profile_url: opcProfileUrl(username),
  };
}

export function parseOpcPage(payload: unknown, feed: OpcFeed): OpcPage {
  const root = record(payload);
  const rows = feed === "products" ? root.projects : root.data;
  const pagination = record(root.pagination);
  if (!Array.isArray(rows) || rows.length > 50 || !Number.isInteger(pagination.totalPages) || Number(pagination.totalPages) < 0) {
    throw new Error("OPC圈列表格式变化，未推进采集页码。");
  }
  const items: OpcItem[] = [];
  let oldest: string | null = null;
  for (const raw of rows) {
    const row = record(raw);
    const id = text(feed === "products" ? row.slug : row.id, 300);
    const stamp = text(row.createdAt, 40);
    const body = text(feed === "products" ? row.description : row.content);
    if (!id || /[\/?#\\]/.test(id) || !stamp || !Number.isFinite(Date.parse(stamp))) {
      throw new Error("OPC圈条目缺少标识或有效时间，未推进采集页码。");
    }
    const publishedAt = new Date(stamp).toISOString();
    if (!oldest || publishedAt < oldest) oldest = publishedAt;
    const title = text(feed === "products" ? row.name : row.title, 300) || body.slice(0, 80);
    if (!title || !body) throw new Error("OPC圈条目缺少标题或正文，未推进采集页码。");
    const author = record(feed === "products" ? row.owner : row.author);
    const facts = feed === "products"
      ? `作者标注阶段：${text(row.stage, 60)}；类别：${text(row.category, 100)}`
      : JSON.stringify({ budgetMin: row.budgetMin ?? null, budgetMax: row.budgetMax ?? null, budgetType: row.budgetType ?? null, deadline: row.deadline ?? null });
    items.push({ url: `https://www.opcquan.com/${feed === "products" ? "projects" : "plaza"}/${encodeURIComponent(id)}`,
      feed, title, body, publishedAt, region: text(author.location, 100), facts, author: parseAuthor(author) });
  }
  return { items, totalPages: Number(pagination.totalPages), oldest };
}

export function opcFetchErrorReason(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return "请求超时";
    if (/^OPC圈接口返回 \d{3}$/.test(error.message)) return error.message;
    if (error.message.startsWith("OPC圈列表格式") || error.message.startsWith("OPC圈条目")) return "列表格式变化";
    if (error.message === "OPC圈响应过大") return "响应超过大小限制";
    if (error instanceof SyntaxError) return "返回不是 JSON";
  }
  return "网络请求失败";
}

export async function fetchOpcPage(feed: OpcFeed, page: number, timeoutMs: number, fetcher: typeof fetch = fetch): Promise<OpcPage> {
  const path = feed === "products" ? "/api/plaza/projects" : "/api/posts?type=DEMAND";
  const url = `https://www.opcquan.com${path}${path.includes("?") ? "&" : "?"}page=${page}&limit=50`;
  const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`OPC圈接口返回 ${response.status}`);
  // Bound decoded response size as well as request duration.
  if (Number(response.headers.get("content-length")) > 4_000_000) throw new Error("OPC圈响应过大");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("OPC圈响应为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4_000_000) { await reader.cancel(); throw new Error("OPC圈响应过大"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseOpcPage(JSON.parse(new TextDecoder().decode(bytes)), feed);
}
