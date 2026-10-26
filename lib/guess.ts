const EXCLUDED = /汽车|机器人|具身|芯片|服务器制造/;

/** 更具体的赛道放前面，避免「政务智能体」被泛化成 T02。 */
const RULES: Array<{ code: string; words: string[] }> = [
  { code: "T05", words: ["模型券", "算力券", "算力补贴"] },
  { code: "T08", words: ["政务", "园区", "一网通办"] },
  { code: "T10", words: ["服务商", "资源池", "入库"] },
  { code: "T07", words: ["数据标注", "标注", "语料"] },
  { code: "T03", words: ["驻场", "FDE", "上线交接", "前场部署"] },
  { code: "T04", words: ["一人公司", "OPC"] },
  { code: "T09", words: ["数改", "中小企业", "数字化转型", "数字化改造"] },
  { code: "T06", words: ["行业大模型", "行业模型"] },
  { code: "T01", words: ["知识库", "RAG", "rag", "知识治理", "文档问答"] },
  { code: "T02", words: ["智能体", "Agent", "agent"] },
];

/** 与内置规则相同，更具体的赛道在前。主赛道取这个顺序的第一个命中。 */
export const TRACK_MATCH_ORDER = RULES.map((rule) => rule.code);

export type TrackDictionary = { code: string; keywords: string };

export function keywordList(keywords: string): string[] {
  return keywords
    .split(/[\n,，、]/)
    .map((word) => word.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);
}

/** 返回全部命中的赛道，顺序仍是更具体的在前。词典里写了关键词就用词典，留空则用内置词。 */
export function guessTracks(text: string, dictionaries?: TrackDictionary[]): string[] {
  if (EXCLUDED.test(text)) return [];
  const custom = new Map((dictionaries ?? []).map((item) => [item.code, keywordList(item.keywords)]));
  const found: string[] = [];
  for (const rule of RULES) {
    const override = custom.get(rule.code);
    const words = override && override.length > 0 ? override : rule.words;
    if (words.some((word) => word && text.includes(word))) found.push(rule.code);
  }
  return found;
}

export function guessTrack(text: string, dictionaries?: TrackDictionary[]): string | null {
  return guessTracks(text, dictionaries)[0] ?? null;
}

export function exclusionNote(text: string): string | null {
  if (!EXCLUDED.test(text)) return null;
  return "命中排除方向（汽车 / 机器人 / 具身 / 芯片 / 服务器制造），不映射赛道。";
}
