import { exclusionNote, matchTrackWords, type TrackDictionary } from "@/lib/guess";
import { extractNoticeFacts, fallbackStudioAngle, type NoticeFacts } from "@/lib/notice-facts";

/** 单独出现时口径太宽，不能据此把政策放进机会清单。 */
const BROAD_WORDS = new Set(["中小企业", "政务", "园区", "入库", "标注", "服务商"]);

/** 这些词说明文本里还有工作室能接的软件切口。 */
const STUDIO_CONTEXT = ["人工智能", "大模型", "软件", "智能体", "知识库", "数字化", "Agent", "agent", "RAG", "rag"];

export type PolicyReading = NoticeFacts & {
  keep: boolean;
  reason: "kept" | "excluded" | "unmapped" | "broad";
  tracks: string[];
  summary: string;
  excerpt: string;
  opportunity: string;
};

function excerptAround(text: string, word: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const index = compact.indexOf(word);
  if (index < 0) return compact.slice(0, 80);
  const start = Math.max(0, index - 16);
  const end = Math.min(compact.length, index + word.length + 24);
  let slice = compact.slice(start, end).trim();
  if (start > 0) slice = `…${slice}`;
  if (end < compact.length) slice = `${slice}…`;
  return slice.slice(0, 120);
}

const NO_FACTS: NoticeFacts = {
  publishedAt: null,
  studioAngle: null,
  subsidyNote: null,
  participationNote: null,
  whoCanApply: null,
  contactNote: null,
  windowNote: null,
};

/** 判断政策是否值得入库，并按正文写出机会、福利、路径、门槛和联络人。 */
export function readPolicy(text: string, dictionaries?: TrackDictionary[]): PolicyReading {
  const empty = { tracks: [] as string[], summary: "", excerpt: "", opportunity: "", ...NO_FACTS };
  if (exclusionNote(text)) return { keep: false, reason: "excluded", ...empty };
  const matches = matchTrackWords(text, dictionaries);
  if (matches.length === 0) return { keep: false, reason: "unmapped", ...empty };
  const tracks = matches.map((item) => item.code);
  const specific = [...new Set(matches.flatMap((item) => item.words.filter((word) => !BROAD_WORDS.has(word))))];
  const context = STUDIO_CONTEXT.filter((word) => text.includes(word));
  if (specific.length === 0 && context.length === 0) {
    return { keep: false, reason: "broad", tracks, summary: "", excerpt: "", opportunity: "", ...NO_FACTS };
  }
  const focus = specific.length > 0 ? specific.slice(0, 4) : context.slice(0, 3);
  const anchor = focus[0] ?? matches[0]?.words[0] ?? "";
  const facts = extractNoticeFacts(text);
  const opportunity = (facts.studioAngle || fallbackStudioAngle(text)).slice(0, 500);
  const summary = (facts.subsidyNote || "").slice(0, 500);
  const title = text.split("\n")[0] ?? text;
  const around = excerptAround(text, anchor);
  const excerpt = text.length < 180 ? around : "";
  return {
    keep: true,
    reason: "kept",
    tracks,
    summary,
    excerpt,
    opportunity,
    ...facts,
    studioAngle: opportunity || null,
    subsidyNote: summary || null,
  };
}
