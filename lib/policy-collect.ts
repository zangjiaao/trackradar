import { exclusionNote, type TrackDictionary } from "@/lib/guess";
import { readPolicy } from "@/lib/policy-read";
import { extractItemDate, withinLookback } from "@/lib/source-window";

/** 低于这个分数的候选不进入政策清单。 */
export const RELEVANCE_THRESHOLD = 50;

/** 每个信源本轮最多采集这么多条，避免正文抓取撑满 Worker 时间。 */
export const COLLECT_PER_SOURCE = 4;

const STUDIO_WORDS = ["智能体", "知识库", "FDE", "数字化", "软件", "大模型", "RAG", "rag", "Agent", "agent", "数改"];

export type ListNotice = { title: string; url: string };

export type EligibleNotice = ListNotice & { publishedAt: string | null };

export type ScoreMode = "agent" | "local" | "fallback";

export type ScanTally = {
  collected: number;
  scored: number;
  filtered: number;
  interpreted: number;
  listCount: number;
  bodyReads: number;
  droppedOld: number;
  droppedHardware: number;
  budgetSkipped: number;
  duplicate: number;
  scorer: ScoreMode;
};

/** 正文从标题最后一次出现处截起，避开页头导航里的「政务」「园区」。 */
export function focusArticleText(title: string, text: string): string {
  const needle = title.replace(/\s+/g, "").slice(0, 14);
  if (needle.length < 6) return text;
  const at = text.replace(/\s+/g, "").lastIndexOf(needle);
  if (at <= 0) return text;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\s/.test(text[index] ?? "")) continue;
    if (seen === at) return text.slice(index);
    seen += 1;
  }
  return text;
}

/** 采集前只丢掉过期和硬件。赛道没对上的标题留在候选里。 */
export function partitionListItems(
  items: ListNotice[],
  lookbackDays: number,
  now = new Date(),
): { eligible: EligibleNotice[]; droppedOld: number; droppedHardware: number } {
  const eligible: Array<EligibleNotice & { rank: number; iso: string; index: number }> = [];
  let droppedOld = 0;
  let droppedHardware = 0;
  items.forEach((item, index) => {
    const title = item.title.trim();
    const url = item.url.trim();
    if (!title || !url) return;
    if (exclusionNote(`${title}\n${url}`)) {
      droppedHardware += 1;
      return;
    }
    const found = extractItemDate(title, url);
    if (!withinLookback(found, lookbackDays, now)) {
      droppedOld += 1;
      return;
    }
    const day = found?.precision === "day";
    eligible.push({
      title,
      url,
      publishedAt: day ? found.iso : null,
      rank: day ? 2 : found ? 1 : 0,
      iso: found?.iso ?? "",
      index,
    });
  });
  eligible.sort((left, right) => right.rank - left.rank || right.iso.localeCompare(left.iso) || left.index - right.index);
  return {
    eligible: eligible.map(({ title, url, publishedAt }) => ({ title, url, publishedAt })),
    droppedOld,
    droppedHardware,
  };
}

/** 本地相关性。词典命中最高；正文里的工作室词次之；过宽或无关低于阈值。 */
export function localRelevance(text: string, dictionaries?: TrackDictionary[]): { score: number; reason: string } {
  if (exclusionNote(text)) {
    return { score: 0, reason: "正文命中汽车、机器人、具身、芯片或服务器制造，不进入政策清单。" };
  }
  const reading = readPolicy(text, dictionaries);
  if (reading.keep) {
    return { score: 74, reason: "标题或正文能对上赛道，且和工作室的软件交付有关。" };
  }
  const studio = STUDIO_WORDS.filter((word) => text.includes(word));
  if (studio.length > 0) {
    return { score: 62, reason: `出现${studio.slice(0, 3).join("、")}，赛道词典未命中，仍和工作室的智能体、知识库或软件数改有关。` };
  }
  if (reading.reason === "broad") {
    return { score: 24, reason: "只有中小企业、园区、政务这类过宽口径，没有软件或智能体切口。" };
  }
  return { score: 12, reason: "标题和正文都看不出与智能体、知识库、FDE 或软件数改的关系。" };
}

export function clampRelevance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scorerLabel(scorer: ScoreMode): string {
  if (scorer === "agent") return "评分用 Agent";
  if (scorer === "fallback") return "模型未返回，改用本地规则";
  return "未配置模型，按本地规则评分";
}

/** 执行记录：采集、评了、低分过滤、解读写入，并附上列表和预算。 */
export function formatScanSourceMessage(region: string, name: string, tally: ScanTally): string {
  const head = `${region}·${name}：采集 ${tally.collected}，评了 ${tally.scored}，低分过滤 ${tally.filtered}，解读写入 ${tally.interpreted}`;
  const tail = [
    `列表 ${tally.listCount}`,
    `读正文 ${tally.bodyReads}`,
    `过期 ${tally.droppedOld}`,
    `硬件排除 ${tally.droppedHardware}`,
    `预算未采 ${tally.budgetSkipped}`,
    tally.duplicate ? `已有 ${tally.duplicate}` : "",
    tally.scored > 0 ? scorerLabel(tally.scorer) : "",
  ].filter(Boolean);
  return `${head}。${tail.join("，")}。`;
}
