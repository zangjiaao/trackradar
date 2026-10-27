/** Tavily Search。默认 5 条，对话侧最多 10 条。 */
export const WEB_SEARCH_DEFAULT_RESULTS = 5;
export const WEB_SEARCH_MAX_RESULTS = 10;
export const WEB_SEARCH_SNIPPET_LIMIT = 400;
export const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResult =
  | { ok: true; query: string; results: WebSearchHit[] }
  | { ok: false; error: string };

export type WebSearchRequest = {
  query: string;
  maxResults?: number;
  apiKey: string | null | undefined;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
};

export function clampSearchResults(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return WEB_SEARCH_DEFAULT_RESULTS;
  return Math.min(WEB_SEARCH_MAX_RESULTS, Math.max(1, Math.trunc(value)));
}

export function presentTavilyKey(
  stored: string | undefined,
  envKey: string | undefined,
): { configured: boolean; from: "settings" | "env" | null; keyHint: string | null } {
  const saved = stored?.trim() ?? "";
  const fromEnv = envKey?.trim() ?? "";
  if (saved) return { configured: true, from: "settings", keyHint: `已保存，末四位 ${saved.slice(-4)}` };
  if (fromEnv) return { configured: true, from: "env", keyHint: "使用环境变量 TAVILY_API_KEY" };
  return { configured: false, from: null, keyHint: null };
}

export function normalizeTavilyKey(input: string): { ok: true; key: string } | { ok: false; error: string } {
  const key = input.trim();
  if (key.length < 8 || key.length > 400 || /[\r\n\s]/.test(key)) {
    return { ok: false, error: "Tavily API Key 长度或格式不对。" };
  }
  return { ok: true, key };
}

export async function webSearch(input: WebSearchRequest): Promise<WebSearchResult> {
  const query = input.query.trim().replace(/\s+/g, " ");
  if (!query) return { ok: false, error: "搜索词是空的。" };
  if (query.length > 400) return { ok: false, error: "搜索词过长。" };
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return { ok: false, error: "未配置 Tavily 密钥。请到配置页填写，或在 .dev.vars 写入 TAVILY_API_KEY。" };
  }

  const maxResults = clampSearchResults(input.maxResults);
  const fetchImpl = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: maxResults,
        chunks_per_source: 1,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        auto_parameters: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/timeout|timed out|aborted/i.test(message)) return { ok: false, error: "联网搜索超时。请稍后再试。" };
    return { ok: false, error: "联网搜索失败。请稍后再试。" };
  }

  const raw = await readBounded(response, 200_000);
  if (!response.ok) return { ok: false, error: mapTavilyStatus(response.status, raw, apiKey) };
  if (raw.length >= 200_000) return { ok: false, error: "搜索结果过长，已放弃。" };

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "Tavily 没有返回搜索结果。" };
  }
  const results = slimResults(payload);
  if (!results) return { ok: false, error: "Tavily 没有返回搜索结果。" };
  return { ok: true, query, results };
}

function slimResults(payload: unknown): WebSearchHit[] | null {
  if (!payload || typeof payload !== "object") return null;
  const list = (payload as { results?: unknown }).results;
  if (!Array.isArray(list)) return null;
  const hits: WebSearchHit[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as { title?: unknown; url?: unknown; content?: unknown };
    if (typeof record.url !== "string" || !/^https?:\/\//i.test(record.url)) continue;
    const title = typeof record.title === "string" && record.title.trim() ? record.title.trim() : record.url;
    hits.push({ title: clip(title, 180), url: record.url, snippet: snippetOf(record.content) });
  }
  return hits;
}

function snippetOf(content: unknown): string {
  if (typeof content !== "string") return "";
  const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clip(text, WEB_SEARCH_SNIPPET_LIMIT);
}

function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

export function mapTavilyStatus(status: number, body: string, apiKey?: string): string {
  if (status === 401 || status === 403) return "Tavily 密钥无效。请到配置页更换，或检查 TAVILY_API_KEY。";
  if (status === 429) return "Tavily 请求过于频繁。请稍后再搜，不要连续搜很多次。";
  if (status === 432 || status === 433) return "Tavily 额度已用尽。请到 Tavily 控制台查看用量后再搜。";
  if (status === 400) return "搜索请求无效。请缩短搜索词后再试。";
  const detail = sanitizeTavilyDetail(body, apiKey);
  return detail ? `联网搜索失败（HTTP ${status}）：${detail}` : `联网搜索失败（HTTP ${status}）。`;
}

function sanitizeTavilyDetail(body: string, apiKey?: string): string {
  let detail = "";
  try {
    const payload = JSON.parse(body) as { detail?: unknown; error?: unknown };
    const nested = payload.detail;
    if (nested && typeof nested === "object" && typeof (nested as { error?: unknown }).error === "string") {
      detail = (nested as { error: string }).error;
    } else if (typeof payload.error === "string") detail = payload.error;
  } catch {
    detail = "";
  }
  const secret = apiKey?.trim() ?? "";
  if (secret.length >= 8) detail = detail.split(secret).join("");
  return detail
    .replace(/bearer\s+\S+/gi, "")
    .replace(/tvly-[A-Za-z0-9_-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function readBounded(response: Response, maxChars: number): Promise<string> {
  try {
    const text = await response.text();
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return "";
  }
}
