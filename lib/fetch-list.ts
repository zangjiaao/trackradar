import { browserHeaders, readResponseText } from "./browser-headers";
import { extractListItems, type ListItem } from "./extract-links";
import { walkListPages } from "./list-pages";
import { findZhejiangUnits, preferListUnits, zhejiangUnitUrl } from "./zhejiang-unit";

export type FetchListOptions = {
  lookbackDays?: number;
  now?: Date;
  deadline?: number;
  maxPages?: number;
  fetch?: typeof fetch;
};

type PageFetch = typeof fetch;

async function loadDocument(url: string, load: PageFetch): Promise<{ html: string; finalUrl: string } | { error: string }> {
  try {
    const response = await load(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: browserHeaders(url, { accept: "document" }),
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const html = await readResponseText(response);
    const finalUrl = response.url || url;
    return { html: await hydrateZhejiangList(html, finalUrl, load), finalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败";
    return { error: message };
  }
}

async function hydrateZhejiangList(html: string, pageUrl: string, load: PageFetch): Promise<string> {
  if (extractListItems(html, pageUrl).length >= 3) return html;
  const units = preferListUnits(findZhejiangUnits(html)).slice(0, 2);
  let best = html;
  let bestCount = extractListItems(best, pageUrl).length;
  for (const unit of units) {
    const endpoint = zhejiangUnitUrl(pageUrl, unit);
    try {
      const response = await load(endpoint, {
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
        headers: browserHeaders(endpoint, { accept: "xhr", referer: pageUrl }),
      });
      if (!response.ok) continue;
      const payload = JSON.parse(await readResponseText(response)) as { data?: { html?: string } };
      const fragment = payload.data?.html;
      if (!fragment) continue;
      const count = extractListItems(fragment, pageUrl).length;
      if (count > bestCount) {
        best = fragment;
        bestCount = count;
      }
    } catch {
      continue;
    }
  }
  return best;
}

export async function fetchPolicyList(
  listUrl: string,
  options: FetchListOptions = {},
): Promise<{ items: ListItem[]; error?: string; pages: number }> {
  const load = options.fetch ?? fetch;
  return walkListPages(listUrl, (url) => loadDocument(url, load), {
    lookbackDays: options.lookbackDays ?? 365,
    now: options.now,
    deadline: options.deadline,
    maxPages: options.maxPages,
  });
}
