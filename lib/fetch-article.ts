function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCharCode(Number(value)))
    .replace(/\s+/g, " ")
    .trim();
}

export function articlePublishedAt(html: string): string | null {
  const meta = html.match(/name="PubDate"\s+content="(20\d{2}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?"/i);
  const labeled = html.match(/发布时间[:：]\s*(20\d{2}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
  const match = meta ?? labeled;
  if (!match) return null;
  return match[2] ? `${match[1]} ${match[2]}` : match[1];
}

export async function fetchPolicyArticle(url: string): Promise<{ text: string; publishedAt: string | null } | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "TrackRadarMVP/0.1" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const text = htmlToText(html).slice(0, 12_000);
    if (text.length < 80) return null;
    return { text, publishedAt: articlePublishedAt(html) };
  } catch {
    return null;
  }
}
