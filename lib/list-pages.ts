import { extractListItems, nextListPage, type ListItem } from "./extract-links";
import { extractItemDate, withinLookback } from "./source-window";

/** 同一列表最多翻这么多页，避免 50 页以上的栏目吃光回看时间。 */
export const LIST_PAGE_CAP = 8;

export function newestNoticeDay(items: Array<{ title: string; url: string; publishedAt?: string | null }>): string | null {
  let newest: string | null = null;
  for (const item of items) {
    const explicit = item.publishedAt?.trim() ?? "";
    const found = explicit ? extractItemDate(explicit, "") : extractItemDate(item.title, item.url);
    if (!found || found.precision !== "day") continue;
    if (!newest || found.iso > newest) newest = found.iso;
  }
  return newest;
}

/** 这一页还有回看窗口内的发布日，或完全没有日期时，继续翻下一页。整页都早于窗口则停止。 */
export function pageExtendsLookback(items: ListItem[], lookbackDays: number, now: Date): boolean {
  const newest = newestNoticeDay(items);
  if (!newest) return true;
  return withinLookback({ iso: newest, precision: "day" }, lookbackDays, now);
}

export type ListPageLoad = (url: string) => Promise<{ html: string; finalUrl: string } | { error: string }>;

export async function walkListPages(
  startUrl: string,
  load: ListPageLoad,
  options: { lookbackDays: number; now?: Date; maxPages?: number; deadline?: number },
): Promise<{ items: ListItem[]; pages: number; error?: string }> {
  const now = options.now ?? new Date();
  const maxPages = options.maxPages ?? LIST_PAGE_CAP;
  const items: ListItem[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  let url = startUrl;
  let pages = 0;
  while (pages < maxPages && url && !visited.has(url)) {
    if (options.deadline != null && Date.now() > options.deadline) break;
    visited.add(url);
    const loaded = await load(url);
    pages += 1;
    if ("error" in loaded) {
      if (pages === 1) return { items: [], pages, error: loaded.error };
      break;
    }
    const pageItems = extractListItems(loaded.html, loaded.finalUrl || url);
    for (const item of pageItems) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
    if (!pageExtendsLookback(pageItems, options.lookbackDays, now)) break;
    const next = nextListPage(loaded.html, loaded.finalUrl || url);
    if (!next || visited.has(next)) break;
    url = next;
  }
  return { items, pages };
}
