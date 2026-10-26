export type ListItem = {
  title: string;
  url: string;
};

const ANCHOR = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
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

export function extractListItems(html: string, baseUrl: string, limit = 30): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();
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
