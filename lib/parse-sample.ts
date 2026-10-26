import type { ParsedSample } from "./domain";
import { exclusionNote, guessTrack } from "./guess";

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const ANCHOR = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
const URL_PATTERN = /https?:\/\/[^\s<>"'）)]+/gi;

function readAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? "";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimUrl(url: string): string {
  return url.replace(/[),.;，。、]+$/g, "");
}

function findPrice(text: string): string | null {
  const match = text.match(
    /(?:¥|￥)\s?\d+(?:\.\d+)?(?:\s?[-~～到至]\s?(?:¥|￥)?\s?\d+(?:\.\d+)?)?|价格\s*[:：]\s*\S{1,24}|面议|\d+(?:\.\d+)?\s*元/,
  );
  return match ? match[0].trim() : null;
}

export function parsePastedSamples(text: string): ParsedSample[] {
  const items: ParsedSample[] = [];
  const seen = new Set<string>();

  const push = (title: string, rawUrl: string, context: string) => {
    const url = trimUrl(rawUrl.trim());
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    const cleanedTitle = title.replace(/\s+/g, " ").trim();
    if (!cleanedTitle) return;
    seen.add(url);
    const blob = `${cleanedTitle}\n${context}`;
    items.push({
      title: cleanedTitle.slice(0, 300),
      url: url.slice(0, 2000),
      price_or_signal: findPrice(context),
      track_guess: guessTrack(blob),
      note: exclusionNote(blob),
    });
  };

  for (const match of text.matchAll(MARKDOWN_LINK)) {
    push(match[1] ?? "", match[2] ?? "", match[0] ?? "");
  }

  for (const match of text.matchAll(ANCHOR)) {
    const href = readAttr(match[1] ?? "", "href") ?? "";
    if (!/^https?:\/\//i.test(href)) continue;
    const title = (readAttr(match[1] ?? "", "title") || stripTags(match[2] ?? "")).trim();
    push(title, href, match[0] ?? "");
  }

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const urls = [...line.matchAll(URL_PATTERN)].map((match) => match[0] ?? "");
    if (urls.length === 0) continue;
    for (const rawUrl of urls) {
      let title = line.replace(URL_PATTERN, " ").replace(/^[\s>*\-•\d.)、]+/, "").trim();
      if (title.length < 2) title = (lines[index - 1] ?? "").trim();
      if (!title || /^https?:\/\//i.test(title)) title = trimUrl(rawUrl);
      const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join("\n");
      push(title, rawUrl, context);
    }
  }

  return items.slice(0, 50);
}
