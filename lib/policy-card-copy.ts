import { formatValueScore } from "@/lib/lead-presentation";

/** 卡片上不展示的占位句和套话。分字段仍留在库里给对话用。 */
const NOISE = /与\s*T\d{2}|映射\s*T\d{2}|做个?\s*demo|demo 或申报|分数是价值分|分数是骨架分|信源回看约|列表页骨架|种子线索|启发式/;

const TEMPLATE_SENTENCE =
  /^(通知里有人工智能或大模型场景，可以用智能体或知识库交付其中的软件部分|按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分)[。！？]?$/;

export type PolicyCardCopy = {
  title: string;
  summary: string | null;
  relevant_excerpt: string | null;
  opportunity_note: string | null;
  studio_angle: string | null;
  subsidy_note: string | null;
  participation_note: string | null;
  who_can_apply: string | null;
  contact_note: string | null;
  window_note: string | null;
};

function splitSentences(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  return compact
    .split(/(?<=[。！？])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function keepSentence(sentence: string): boolean {
  if (!sentence || NOISE.test(sentence) || TEMPLATE_SENTENCE.test(sentence)) return false;
  if (/^地域是[\u4e00-\u9fa5A-Za-z0-9（）()]{1,16}[。！？]?$/.test(sentence)) return false;
  return true;
}

function withPeriod(text: string): string {
  return /[。！？]$/.test(text) ? text : `${text}。`;
}

function usableBlock(value: string | null | undefined): string | null {
  const kept = splitSentences(value ?? "").filter(keepSentence);
  if (!kept.length) return null;
  return kept.map(withPeriod).join("").replace(/。{2,}/g, "。");
}

function sameText(left: string | null, right: string | null): boolean {
  const norm = (value: string | null) => (value ?? "").replace(/\s+/g, "");
  return Boolean(left && right && norm(left) === norm(right));
}

/**
 * 政策卡片只放一段解读：工作室关系（studio_angle / opportunity_note），没有再用独立摘要。
 * 福利、参与、门槛、联络人、窗口不进卡片。
 */
export function policyCardReading(lead: PolicyCardCopy): string | null {
  const angle = usableBlock(lead.studio_angle) || usableBlock(lead.opportunity_note);
  if (angle) return angle;
  const summary = usableBlock(lead.summary);
  if (summary && !sameText(summary, usableBlock(lead.subsidy_note))) return summary;
  return null;
}

/** 卡片右上角只显示数字。没有分时显示「未评分」。 */
export function policyScoreLabel(total: number | null | undefined): { text: string; scored: boolean } {
  const labeled = formatValueScore(total);
  if (labeled === "未评分") return { text: labeled, scored: false };
  return { text: labeled.replace(/^价值分\s*/, ""), scored: true };
}
