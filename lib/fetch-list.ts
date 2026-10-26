import { extractListItems, type ListItem } from "./extract-links";

export async function fetchPolicyList(listUrl: string): Promise<{ items: ListItem[]; error?: string }> {
  try {
    const response = await fetch(listUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TrackRadarMVP/0.1",
      },
    });
    if (!response.ok) {
      return { items: [], error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const base = response.url || listUrl;
    return { items: extractListItems(html, base) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "抓取失败";
    return { items: [], error: message };
  }
}
