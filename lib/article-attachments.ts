import { focusArticleText } from "@/lib/policy-collect";

/** 单篇通知最多跟这么多份 PDF，避免把回看预算耗在附件上。 */
export const MAX_PDF_ATTACHMENTS = 2;

/** 超过这个体积的 PDF 不下载。西安目录清单约 1.3MB，留一点余量。 */
export const MAX_PDF_BYTES = 2_000_000;

/** 单份 PDF 的下载加解析上限。 */
export const PDF_FETCH_MS = 8_000;

/** 一篇通知的全部附件合计不超过这段时间。 */
export const ATTACHMENT_BUDGET_MS = 12_000;

/** 入库并交给模型的正文上限。附件占其中大部分，避免概述把目录截掉。 */
export const NOTICE_BODY_LIMIT = 6_000;

/** 评估提示词里的正文上限，要盖住入库正文。 */
export const ASSESSMENT_BODY_LIMIT = 8_000;

export const ATTACHMENT_MARKER = "\n\n【附件摘录】\n";

const PDF_HREF = /\.pdf$/i;
const ANCHOR = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
const RELEVANT = /人工智能|软件|智能体|知识库|RAG|大模型|数字员工/i;

function readHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  const decoded = href
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
  return decoded || null;
}

function isPdfHref(href: string): boolean {
  const path = href.split("#")[0]?.split("?")[0] ?? href;
  return PDF_HREF.test(path);
}

/** 页面里的 PDF 链接。带「附件」的排在前面，最多两份。 */
export function listPdfAttachments(html: string, pageUrl: string): string[] {
  const found: Array<{ url: string; attached: boolean }> = [];
  const seen = new Set<string>();
  ANCHOR.lastIndex = 0;
  for (const match of html.matchAll(ANCHOR)) {
    const href = readHref(match[1] ?? "");
    if (!href || !isPdfHref(href)) continue;
    let absolute: URL;
    try {
      absolute = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;
    if (seen.has(absolute.href)) continue;
    seen.add(absolute.href);
    const label = (match[2] ?? "").replace(/<[^>]+>/g, " ");
    found.push({ url: absolute.href, attached: /附件/.test(label) });
  }
  found.sort((left, right) => Number(right.attached) - Number(left.attached));
  return found.slice(0, MAX_PDF_ATTACHMENTS).map((item) => item.url);
}

/**
 * 附件太长时优先留下人工智能、软件、智能体、知识库附近的产品条目。
 * 窗口要盖住条目名称和一句场景，目录类通知靠这些条目定 demo。
 * 验收公示这类名单通常没有这些词，就保留开头，避免抽完变成空的。
 */
export function excerptAttachmentText(raw: string, limit: number): string {
  const text = raw.replace(/\u0000/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text || limit <= 0) return "";
  if (text.length <= limit) return text;

  const windows: Array<{ start: number; end: number }> = [];
  const pattern = new RegExp(RELEVANT.source, "gi");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    windows.push({
      start: Math.max(0, match.index - 48),
      end: Math.min(text.length, match.index + match[0].length + 180),
    });
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  if (windows.length === 0) return text.slice(0, limit);

  windows.sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.start <= last.end + 12) last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }

  const parts: string[] = [];
  let used = 0;
  for (const window of merged) {
    const slice = text.slice(window.start, window.end).trim();
    if (!slice) continue;
    const room = limit - used;
    if (room <= 12) break;
    const piece = slice.slice(0, room);
    parts.push(piece);
    used += piece.length + 1;
    if (piece.length < slice.length) break;
  }
  const joined = parts.join("\n").trim();
  return joined.length >= 12 ? joined : text.slice(0, limit);
}

/** 只对通知 HTML 做标题聚焦，再把附件摘录接回去。标题若在摘录里再次出现，也不会把摘录截掉。 */
export function storedNoticeBody(title: string, text: string, limit = NOTICE_BODY_LIMIT): string {
  const at = text.indexOf(ATTACHMENT_MARKER);
  const notice = (at >= 0 ? text.slice(0, at) : text).trim();
  const attachment = at >= 0 ? text.slice(at + ATTACHMENT_MARKER.length).trim() : "";
  const focused = focusArticleText(title, notice).trim();
  if (!attachment) return focused.slice(0, limit);
  const attachmentBudget = Math.min(attachment.length, Math.floor(limit * 0.7));
  const noticeBudget = Math.max(0, limit - attachmentBudget - ATTACHMENT_MARKER.length);
  const noticePart = focused.slice(0, noticeBudget);
  const attachmentPart = attachment.slice(0, attachmentBudget);
  return `${noticePart}${ATTACHMENT_MARKER}${attachmentPart}`.trim();
}

/** 评估提示词里「正文:」后面的内容。测试用它证明附件文本没有在送模型前被截掉。 */
export function assessmentInputText(body: string | null | undefined): string {
  const text = body?.trim();
  if (!text) return "未读到正文";
  return text.slice(0, ASSESSMENT_BODY_LIMIT);
}
