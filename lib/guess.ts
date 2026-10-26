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

export function guessTrack(text: string): string | null {
  if (EXCLUDED.test(text)) return null;
  for (const rule of RULES) {
    if (rule.words.some((word) => text.includes(word))) return rule.code;
  }
  return null;
}

export function exclusionNote(text: string): string | null {
  if (!EXCLUDED.test(text)) return null;
  return "命中排除方向（汽车 / 机器人 / 具身 / 芯片 / 服务器制造），不映射赛道。";
}
