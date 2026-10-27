/** 共用的浏览器式请求头。列表、正文和附件都走这里。 */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type BrowserAccept = "document" | "xhr" | "pdf";

function fetchSite(target: string, referer?: string): "none" | "same-origin" | "cross-site" {
  if (!referer) return "none";
  try {
    return new URL(referer).host === new URL(target).host ? "same-origin" : "cross-site";
  } catch {
    return "cross-site";
  }
}

/** 只声明 gzip/deflate。运行时可以解压；声明 br 时部分环境会把压缩体原样交回来。 */
export function browserHeaders(target: string, options?: { referer?: string; accept?: BrowserAccept }): Headers {
  const accept = options?.accept ?? "document";
  const headers = new Headers();
  headers.set("user-agent", BROWSER_USER_AGENT);
  headers.set("accept-language", "zh-CN,zh;q=0.9,en;q=0.8");
  headers.set("accept-encoding", "gzip, deflate");
  headers.set("sec-ch-ua", '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"');
  headers.set("sec-ch-ua-mobile", "?0");
  headers.set("sec-ch-ua-platform", '"Windows"');
  headers.set("sec-fetch-site", fetchSite(target, options?.referer));
  if (accept === "document") {
    headers.set("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
    headers.set("upgrade-insecure-requests", "1");
    headers.set("sec-fetch-dest", "document");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-user", "?1");
  } else if (accept === "xhr") {
    headers.set("accept", "application/json, text/javascript, */*; q=0.01");
    headers.set("x-requested-with", "XMLHttpRequest");
    headers.set("sec-fetch-dest", "empty");
    headers.set("sec-fetch-mode", "cors");
  } else {
    headers.set("accept", "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8");
    headers.set("sec-fetch-dest", "document");
    headers.set("sec-fetch-mode", "navigate");
  }
  if (options?.referer) headers.set("referer", options.referer);
  return headers;
}

/** 同一站点正文的 Referer，用文章所在主机的站点根。 */
export function sameSiteReferer(url: string): string | undefined {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return undefined;
  }
}

/** 手动声明了 Accept-Encoding 时，响应体可能仍是压缩的。 */
export async function readResponseText(response: Response): Promise<string> {
  const encoding = (response.headers.get("content-encoding") ?? "").toLowerCase();
  if (!encoding || encoding === "identity") return response.text();
  const format = encoding.includes("gzip") ? "gzip" : encoding.includes("deflate") ? "deflate" : null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!format || typeof DecompressionStream === "undefined") return new TextDecoder().decode(bytes);
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return await new Response(stream).text();
  } catch {
    return new TextDecoder().decode(bytes);
  }
}
