import { walkListPages } from "./list-pages";
import type { ListItem } from "./extract-links";

export type FetchListOptions = {
  lookbackDays?: number;
  now?: Date;
  deadline?: number;
  maxPages?: number;
};

async function loadHtml(url: string): Promise<{ html: string; finalUrl: string } | { error: string }> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TrackRadarMVP/0.1",
      },
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const html = await response.text();
    return { html, finalUrl: response.url || url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败";
    return { error: message };
  }
}

export async function fetchPolicyList(
  listUrl: string,
  options: FetchListOptions = {},
): Promise<{ items: ListItem[]; error?: string; pages: number }> {
  return walkListPages(listUrl, loadHtml, {
    lookbackDays: options.lookbackDays ?? 365,
    now: options.now,
    deadline: options.deadline,
    maxPages: options.maxPages,
  });
}
