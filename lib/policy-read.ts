import { exclusionNote, matchTrackWords, type TrackDictionary } from "@/lib/guess";

/** 单独出现时口径太宽，不能据此把政策放进机会清单。 */
const BROAD_WORDS = new Set(["中小企业", "政务", "园区", "入库", "标注", "服务商"]);

/** 这些词说明文本里还有工作室能接的软件切口。 */
const STUDIO_CONTEXT = ["人工智能", "大模型", "软件", "智能体", "知识库", "数字化", "Agent", "agent", "RAG", "rag"];

const TRACK_READ: Record<string, { name: string; capability: string; opportunity: string }> = {
  T01: {
    name: "企业知识库",
    capability: "知识库与业务知识治理",
    opportunity: "机会是做知识库入库和文档问答的 demo，用来接知识治理的单。",
  },
  T02: {
    name: "业务智能体",
    capability: "智能体研发",
    opportunity: "机会是做能调用工具的业务智能体 demo，用来接岗位软件的单。",
  },
  T03: {
    name: "FDE 驻场交付",
    capability: "FDE 部署交接",
    opportunity: "机会是把部署、培训和上线交接做成可报价的交付，而不是只交一个账号。",
  },
  T04: {
    name: "OPC",
    capability: "给一人公司的轻量软件",
    opportunity: "机会是给一人公司做窄的经营或获客工具，适合小 demo，订单通常更碎。",
  },
  T05: {
    name: "模型券",
    capability: "把算力券落到软件场景",
    opportunity: "机会是帮企业把模型券或算力券落到可验收的软件场景，并准备申报材料。不做算力硬件。",
  },
  T06: {
    name: "行业大模型",
    capability: "行业场景里的软件应用",
    opportunity: "机会是把行业场景收成可交付的软件应用 demo，不自训底座模型。",
  },
  T07: {
    name: "语料治理",
    capability: "知识治理相邻的语料和评测",
    opportunity: "机会是做语料口径、清洗和评测，不接纯人力标注外包。",
  },
  T08: {
    name: "政务园区",
    capability: "政务或园区里的软件助手",
    opportunity: "机会是做政务或园区里的知识助手 demo，交付停在软件，用来接场景单或配套申报。",
  },
  T09: {
    name: "中小企业数改",
    capability: "数改里的软件部分",
    opportunity: "机会是承接中小企业数改里的软件部分，用一个岗位流程做 demo 或申报。",
  },
  T10: {
    name: "服务商资源池",
    capability: "进入服务商名录的材料",
    opportunity: "机会是准备入库材料，进入人工智能服务商资源池，换后续被点选的资格。",
  },
};

export type PolicyReading = {
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

/** 判断政策是否值得入库，并写出解读、相关片段和机会。只依据给出的文本，不声称读过全文。 */
export function readPolicy(text: string, dictionaries?: TrackDictionary[]): PolicyReading {
  const empty = { tracks: [] as string[], summary: "", excerpt: "", opportunity: "" };
  if (exclusionNote(text)) return { keep: false, reason: "excluded", ...empty };
  const matches = matchTrackWords(text, dictionaries);
  if (matches.length === 0) return { keep: false, reason: "unmapped", ...empty };
  const tracks = matches.map((item) => item.code);
  const specific = [...new Set(matches.flatMap((item) => item.words.filter((word) => !BROAD_WORDS.has(word))))];
  const context = STUDIO_CONTEXT.filter((word) => text.includes(word));
  if (specific.length === 0 && context.length === 0) {
    return { keep: false, reason: "broad", tracks, summary: "", excerpt: "", opportunity: "" };
  }
  const focus = specific.length > 0 ? specific.slice(0, 4) : context.slice(0, 3);
  const anchor = focus[0] ?? matches[0]?.words[0] ?? "";
  const primary = TRACK_READ[tracks[0] ?? ""];
  const labels = tracks.map((code) => (TRACK_READ[code] ? `${code} ${TRACK_READ[code].name}` : code)).join("、");
  const capability = primary?.capability ?? "工作室的软件能力";
  const summary = `与${labels}相关。文本里和工作室有关的是「${focus.join("、")}」，对应${capability}。`.slice(0, 400);
  const others = tracks.slice(1);
  const opportunity = [primary?.opportunity ?? "机会是做成可演示的软件，并保留这条政策的原链接。", others.length ? `同时涉及 ${others.join("、")}。` : ""]
    .filter(Boolean)
    .join("")
    .slice(0, 400);
  return {
    keep: true,
    reason: "kept",
    tracks,
    summary,
    excerpt: excerptAround(text, anchor),
    opportunity,
  };
}
