/** 对话上下文里单页 Markdown 的上限。超出的部分丢掉，并在文末注明已截断。 */
export const PAGE_MARKDOWN_LIMIT = 24_000;

/** 响应体再大就不解析，避免一条网页撑满 Worker 内存。 */
const RESPONSE_CHAR_LIMIT = 400_000;

const TRUNCATION_NOTE = `\n\n（正文已截断，只保留前 ${PAGE_MARKDOWN_LIMIT} 字。）`;

export type MarkdownQuickAction = {
  quickAction(
    action: "markdown",
    options: {
      url: string;
    },
  ): Promise<Response>;
};

export type PageMarkdownResult =
  | { ok: true; url: string; title: string | null; markdown: string; truncated: boolean }
  | { ok: false; url?: string; error: string };

export function parsePageUrl(input: string): { url: string } | { error: string } {
  const value = input.trim();
  if (!value) return { error: "缺少网页链接。" };
  if (value.length > 2000) return { error: "链接过长。" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "链接不是有效的网址。" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "只打开 http 或 https 链接。" };
  }
  if (url.username || url.password) return { error: "链接不能带账号或密码。" };
  if (!url.hostname) return { error: "链接缺少主机名。" };
  if (isBlockedHost(url.hostname)) return { error: "不打开本机或内网地址。" };
  return { url: url.toString() };
}

export function truncateMarkdown(text: string, limit = PAGE_MARKDOWN_LIMIT): { markdown: string; truncated: boolean } {
  if (text.length <= limit) return { markdown: text, truncated: false };
  return { markdown: `${text.slice(0, limit)}${TRUNCATION_NOTE}`, truncated: true };
}

export function mapBrowserStatus(status: number, detail: string): string {
  if (status === 429) {
    return "Browser Run 已达频率或当日浏览器时间上限（429）。Free 计划每天浏览器时间有限，请稍后再打开这一页，不要连续抓很多链接。";
  }
  if (isTimeout(status, detail)) return "打开页面超时。可以稍后再试这一条链接。";
  if (status === 422) return "页面未能转成 Markdown（422）。常见原因是加载超时或页面报错。";
  return `打开页面失败（HTTP ${status}）。`;
}

export function mapBrowserThrown(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/does not implement the method ["']quickAction["']/i.test(message)) {
    return "本地 Browser 绑定没有 quickAction。请在 wrangler.jsonc 为 browser 设置 remote: true，或改用已登录账号的 wrangler dev --remote。";
  }
  if (/429|browser time limit/i.test(message)) {
    return mapBrowserStatus(429, message);
  }
  if (isTimeout(0, message)) return "打开页面超时。可以稍后再试这一条链接。";
  return "打开页面失败。请稍后再试这一条链接。";
}

export async function fetchPageMarkdown(rawUrl: string, browser: MarkdownQuickAction | null | undefined): Promise<PageMarkdownResult> {
  const parsed = parsePageUrl(rawUrl);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (!browser || typeof browser.quickAction !== "function") {
    return { ok: false, url: parsed.url, error: "未配置 Browser 绑定，无法把网页转成 Markdown。" };
  }

  let response: Response;
  try {
    response = await browser.quickAction("markdown", { url: parsed.url });
  } catch (error) {
    const message = mapBrowserThrown(error);
    logFailure(parsed.url, message);
    return { ok: false, url: parsed.url, error: message };
  }

  const body = await readBoundedText(response, RESPONSE_CHAR_LIMIT);
  if (!response.ok) {
    const message = mapBrowserStatus(response.status, body.text);
    logFailure(parsed.url, message);
    return { ok: false, url: parsed.url, error: message };
  }
  if (body.overflow) {
    const message = "页面返回过长，已放弃。";
    logFailure(parsed.url, message);
    return { ok: false, url: parsed.url, error: message };
  }

  const parsedBody = parseMarkdownBody(body.text);
  if ("error" in parsedBody) {
    logFailure(parsed.url, parsedBody.error);
    return { ok: false, url: parsed.url, error: parsedBody.error };
  }

  const trimmed = parsedBody.markdown.trim();
  if (!trimmed) {
    return { ok: false, url: parsed.url, error: "页面没有可读正文。" };
  }
  const clipped = truncateMarkdown(trimmed);
  return {
    ok: true,
    url: parsed.url,
    title: parsedBody.title,
    markdown: clipped.markdown,
    truncated: clipped.truncated,
  };
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if ([a, b, Number(match[3]), Number(match[4])].some((part) => part > 255)) return false;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isTimeout(status: number, detail: string): boolean {
  return status === 408 || status === 504 || /timeout|timed out|超时/i.test(detail);
}

async function readBoundedText(response: Response, maxChars: number): Promise<{ text: string; overflow: boolean }> {
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return { text: text.slice(0, maxChars), overflow: text.length > maxChars };
    }
    const decoder = new TextDecoder();
    let text = "";
    while (text.length <= maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (text.length > maxChars) {
      await reader.cancel().catch(() => undefined);
      return { text: text.slice(0, maxChars), overflow: true };
    }
    return { text, overflow: false };
  } catch {
    return { text: "", overflow: false };
  }
}

function parseMarkdownBody(body: string): { markdown: string; title: string | null } | { error: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return { error: "Browser Run 没有返回 Markdown。" };
  }
  if (!payload || typeof payload !== "object") return { error: "Browser Run 没有返回 Markdown。" };
  const record = payload as { success?: unknown; result?: unknown; errors?: unknown; meta?: unknown };
  if (record.success === false) {
    const message = firstErrorMessage(record.errors);
    return { error: message ? `打开页面失败：${clip(message)}` : "打开页面失败。" };
  }
  if (record.success !== true || typeof record.result !== "string") {
    return { error: "Browser Run 没有返回 Markdown。" };
  }
  const meta = record.meta;
  const title =
    meta && typeof meta === "object" && typeof (meta as { title?: unknown }).title === "string"
      ? (meta as { title: string }).title
      : null;
  return { markdown: record.result, title };
}

function firstErrorMessage(errors: unknown): string {
  if (!Array.isArray(errors)) return "";
  const first = errors[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function clip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 160)}…` : compact;
}

function logFailure(url: string, message: string): void {
  console.error(JSON.stringify({ event: "fetch_page_markdown_failed", url, message }));
}
