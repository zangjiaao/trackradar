import {
  ATTACHMENT_BUDGET_MS,
  ATTACHMENT_MARKER,
  excerptAttachmentText,
  listPdfAttachments,
  MAX_PDF_BYTES,
  PDF_FETCH_MS,
} from "@/lib/article-attachments";
import { readPdfText } from "@/lib/pdf-text";

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

export type ArticleFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type FetchArticleOptions = {
  fetch?: ArticleFetcher;
  readPdf?: (bytes: Uint8Array) => Promise<string>;
  deadline?: number;
};

function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = response.body?.getReader();
  if (!reader) {
    const buffered = new Uint8Array(await response.arrayBuffer());
    return buffered.byteLength > maxBytes ? null : buffered;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function attachmentExcerpt(
  pageUrl: string,
  html: string,
  options: FetchArticleOptions | undefined,
): Promise<string> {
  const urls = listPdfAttachments(html, pageUrl);
  if (urls.length === 0) return "";
  const load = options?.fetch ?? fetch;
  const readPdf = options?.readPdf ?? readPdfText;
  const budgetEnd = Math.min(options?.deadline ?? Number.POSITIVE_INFINITY, Date.now() + ATTACHMENT_BUDGET_MS);
  const parts: string[] = [];
  for (const [index, pdfUrl] of urls.entries()) {
    const remaining = budgetEnd - Date.now();
    if (remaining < 1_500) break;
    try {
      const response = await load(pdfUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(Math.min(PDF_FETCH_MS, remaining)),
        headers: { accept: "application/pdf,*/*", "user-agent": "TrackRadarMVP/0.1" },
      });
      if (!response.ok) continue;
      const bytes = await readBounded(response, MAX_PDF_BYTES);
      if (!bytes || !looksLikePdf(bytes)) continue;
      const text = await readPdf(bytes);
      const limit = urls.length === 1 ? 4_500 : index === 0 ? 2_800 : 1_600;
      const excerpt = excerptAttachmentText(text, limit);
      if (excerpt) parts.push(excerpt);
    } catch {
      continue;
    }
  }
  return parts.join("\n");
}

export async function fetchPolicyArticle(
  url: string,
  options?: FetchArticleOptions,
): Promise<{ text: string; publishedAt: string | null } | null> {
  try {
    const load = options?.fetch ?? fetch;
    const response = await load(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "TrackRadarMVP/0.1" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const notice = htmlToText(html).slice(0, 12_000);
    const attachment = await attachmentExcerpt(url, html, options);
    if (notice.length < 80 && attachment.length < 40) return null;
    const text = attachment ? `${notice}${ATTACHMENT_MARKER}${attachment}` : notice;
    return { text, publishedAt: articlePublishedAt(html) };
  } catch {
    return null;
  }
}
