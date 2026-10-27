import { composeListDate } from "./source-window";

export type ListItem = {
  title: string;
  url: string;
  publishedAt?: string | null;
};

const ANCHOR = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
const ANCHOR_ONCE = /<a\b([^>]*?)>([\s\S]*?)<\/a>/i;
const SKIP_TITLES = new Set([
  "首页",
  "更多",
  "更多>>",
  "下一页",
  "上一页",
  "下页",
  "上页",
  "确定",
  "登录",
  "注册",
  "返回",
  "网站首页",
  "政务服务",
  "政务公开",
  "English",
]);

function isNavigationTitle(title: string): boolean {
  if (SKIP_TITLES.has(title)) return true;
  return title.length <= 16 && /首页|公开|指南|年报|机构|职能|导航|登录|更多|栏目|地图|声明|备案|简体|繁体/.test(title);
}

function isArticleLink(item: ListItem): boolean {
  if (isNavigationTitle(item.title)) return false;
  if (/\/20\d{4}/.test(item.url) || /t20\d{6}/i.test(item.url) || /[a-f0-9]{20,}/i.test(item.url)) return true;
  return item.title.length >= 22;
}

function readAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? "";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function textContent(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl).href;
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
  } catch {
    return null;
  }
}

/** 日期在条目旁的 date/year 里，不在 a 标签内。每块只取紧随其后的标题链接。 */
function extractDatedNotices(html: string, baseUrl: string): ListItem[] | null {
  const parts = html.split(/news-date/i);
  if (parts.length < 2) return null;
  const items: ListItem[] = [];
  const seen = new Set<string>();
  for (const part of parts.slice(1)) {
    const day = part.match(/class="date"[^>]*>\s*(\d{1,2})\s*</i)?.[1];
    const year = part.match(/class="year"[^>]*>\s*(20\d{2}-\d{2})\s*</i)?.[1];
    const publishedAt = day && year ? composeListDate(day, year) : null;
    const match = part.match(ANCHOR_ONCE);
    if (!match) continue;
    const href = readAttr(match[1] ?? "", "href")?.trim() ?? "";
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
    const titled = decodeEntities(readAttr(match[1] ?? "", "title")?.trim() ?? "");
    const title = titled || textContent(match[2] ?? "");
    if (title.length < 8 || isNavigationTitle(title)) continue;
    const url = resolveUrl(href, baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({ title, url, publishedAt });
  }
  if (!items.some((item) => item.publishedAt)) return null;
  return items;
}

/** 列表页「下一页」。指向当前页或脚本的链接不算。 */
export function nextListPage(html: string, baseUrl: string): string | null {
  let current = "";
  try {
    current = new URL(baseUrl).href;
  } catch {
    current = "";
  }
  ANCHOR.lastIndex = 0;
  for (const match of html.matchAll(ANCHOR)) {
    const label = textContent(match[2] ?? "");
    if (label !== "下一页" && label !== "下页") continue;
    const href = readAttr(match[1] ?? "", "href")?.trim() ?? "";
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
    const url = resolveUrl(href, baseUrl);
    if (!url || url === current) continue;
    return url;
  }
  return null;
}

export function extractListItems(html: string, baseUrl: string, limit = 30): ListItem[] {
  const dated = extractDatedNotices(html, baseUrl);
  if (dated && dated.length > 0) return dated.slice(0, limit);
  const items: ListItem[] = [];
  const seen = new Set<string>();
  ANCHOR.lastIndex = 0;
  for (const match of html.matchAll(ANCHOR)) {
    const href = readAttr(match[1] ?? "", "href")?.trim() ?? "";
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
    if (href.includes("'+") || href.includes("${")) continue;
    const titled = decodeEntities(readAttr(match[1] ?? "", "title")?.trim() ?? "");
    const title = titled || textContent(match[2] ?? "");
    if (title.length < 8 || isNavigationTitle(title) || /^\d+$/.test(title)) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    items.push({ title, url });
  }
  const articles = items.filter(isArticleLink);
  const chosen = articles.length >= 3 ? articles : items;
  return chosen.slice(0, limit);
}
