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
const RELEVANT = /人工智能|软件|智能体|知识库|知识图谱|RAG|大模型|数字员工/i;
/** 和工作室对得上的目录行：知识库、智能体、软件。 */
const STUDIO_ENTRY = /知识库|知识图谱|智能体|RAG|大模型|数字员工|软件/i;
/** 硬件、服务器、纯视觉安防。有对口条目时只作背景，不占摘录主体。 */
const BACKGROUND_ENTRY = /服务器|芯片|机器人|具身|周界|安防|算力|图像检测|视觉识别/;

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

function isCjk(char: string): boolean {
  return /[\u4e00-\u9fa5]/.test(char);
}

/** 表格单元格按行切开后，把被拆开的中文和电话号码接回去。 */
function joinWrapped(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    const part = line.trim();
    if (!part) continue;
    if (!out) {
      out = part;
      continue;
    }
    const prev = out.at(-1) ?? "";
    const next = part[0] ?? "";
    const glue = (isCjk(prev) && isCjk(next)) || (/\d/.test(prev) && /\d/.test(next)) ? "" : " ";
    out += glue + part;
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * 目录 PDF 的序号通常独占一行，并且连续递增。
 * 返回每一行的完整文本：名称、研发单位、简介、意向市场、价格和联系方式。
 */
export function splitCatalogRows(text: string): string[] {
  const lines = text.split(/\n/);
  const marks: Array<{ index: number; n: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.trim().match(/^(\d{1,3})$/);
    if (match) marks.push({ index, n: Number(match[1]) });
  }
  const runs: Array<Array<{ index: number; n: number }>> = [];
  let start = 0;
  for (let index = 1; index <= marks.length; index += 1) {
    const broken = index === marks.length || marks[index].n !== marks[index - 1].n + 1;
    if (!broken) continue;
    if (index - start >= 4) runs.push(marks.slice(start, index));
    start = index;
  }
  if (runs.length === 0) return [];
  const rows: string[] = [];
  const seen = new Set<number>();
  for (const run of runs) {
    for (let index = 0; index < run.length; index += 1) {
      if (seen.has(run[index].n)) continue;
      seen.add(run[index].n);
      const from = run[index].index;
      const next = index + 1 < run.length ? run[index + 1].index : Math.min(lines.length, from + 40);
      const slice: string[] = [];
      for (const line of lines.slice(from, next)) {
        if (slice.length > 0 && line.trim().length > 80) break;
        slice.push(line);
      }
      const row = joinWrapped(slice);
      if (row) rows.push(row);
    }
  }
  return rows;
}

/** 对口条目在前。服务器、周界、纯视觉安防最多留两条作背景。 */
export function rankCatalogRows(rows: string[]): string[] {
  const studio: string[] = [];
  const background: string[] = [];
  for (const row of rows) {
    if (STUDIO_ENTRY.test(row)) studio.push(row);
    else if (BACKGROUND_ENTRY.test(row)) background.push(row);
  }
  if (studio.length === 0) return rows;
  return [...studio, ...background.slice(0, 2)];
}

function packPieces(pieces: string[], limit: number): string {
  const parts: string[] = [];
  let used = 0;
  for (const piece of pieces) {
    const room = limit - used;
    if (room <= 24) break;
    const slice = piece.length > room ? piece.slice(0, room) : piece;
    parts.push(slice);
    used += slice.length + 1;
    if (slice.length < piece.length) break;
  }
  return parts.join("\n").trim();
}

/**
 * 附件太长时，目录按整条产品行保留，优先知识库、智能体、知识图谱和软件。
 * 没有序号表时，退回关键词附近的片段。验收名单没有这些词时保留开头。
 */
export function excerptAttachmentText(raw: string, limit: number): string {
  const text = raw.replace(/\u0000/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text || limit <= 0) return "";
  if (text.length <= limit) return text;

  const rows = splitCatalogRows(text);
  if (rows.length >= 4) {
    const packed = packPieces(rankCatalogRows(rows), limit);
    if (packed.length >= 12) return packed;
  }

  const windows: Array<{ start: number; end: number }> = [];
  const pattern = new RegExp(RELEVANT.source, "gi");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    windows.push({
      start: Math.max(0, match.index - 80),
      end: Math.min(text.length, match.index + match[0].length + 220),
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

/**
 * 入库摘要里的目录明细：对口产品行，含名称、单位、简介、市场和联系方式。
 * 卡片不用这段，对话可以据此追问。没有序号表时，用摘录里带这些词的行。
 */
export function catalogEntryDigest(body: string | null | undefined, limit = 1_600): string {
  const text = body ?? "";
  const at = text.indexOf(ATTACHMENT_MARKER);
  const source = (at >= 0 ? text.slice(at + ATTACHMENT_MARKER.length) : "").trim();
  if (!source || limit <= 0) return "";
  const rows = splitCatalogRows(source);
  const pieces = (rows.length >= 4 ? rows : source.split("\n"))
    .map((row) => row.trim())
    .filter((row) => STUDIO_ENTRY.test(row));
  return packPieces(pieces, limit);
}

/** 政策摘要优先放目录明细。没有明细时用模型写的那段解读。 */
export function storedLeadSummary(reading: string, body: string | null | undefined): string {
  return catalogEntryDigest(body) || reading;
}

/** 评估提示词里「正文:」后面的内容。测试用它证明附件文本没有在送模型前被截掉。 */
export function assessmentInputText(body: string | null | undefined): string {
  const text = body?.trim();
  if (!text) return "未读到正文";
  return text.slice(0, ASSESSMENT_BODY_LIMIT);
}
