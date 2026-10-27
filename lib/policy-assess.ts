import { RELEVANCE_THRESHOLD } from "@/lib/policy-collect";

const TEMPLATE_SENTENCE =
  /^(做这个场景里的软件助手，用来接交付|做知识库入库和文档问答，用来接知识治理的单|准备材料进入人工智能服务商资源池，取得后续被点选的资格|帮企业把模型券或算力券落到可验收的软件场景，并准备申报材料。?不做算力硬件|通知里有人工智能或大模型场景，可以用智能体或知识库交付其中的软件部分|按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分)[。！？]?$/;

const REGION_ONLY = /^地域是[\u4e00-\u9fa5A-Za-z0-9（）()]{1,16}[。！？]?$/;

export const ASSESS_INSTRUCTIONS = [
  "你阅读已经采集的政策正文，判断它值不值得进入工作室的政策清单，并在值得时写一段解读。清单用来整合政府已经采纳、或正在给政府做的产品，方便以后定 demo，不只是多收补贴通知。",
  "工作室做智能体、知识库、FDE，以及软件向的人工智能和数字化改造。不做汽车、机器人、具身智能硬件、芯片、服务器制造。",
  "无关、只有中小企业、园区、政务、入库这类过宽口径，或新闻里只是顺口提到大模型、人工智能、软件，都打到 50 分以下，reading 留空。",
  "例如环卫慰问、节庆或会议新闻只顺口出现「大模型」，不是可接的软件或数改政策，应低分并留空解读，不要写入政策页。",
  "同一数字化转型或数字化改造试点中的验收公示、通过验收企业名单、入库备案、补充备案和分批申报，能说明政府在推什么、谁在做，有情报价值。不要仅因为是公示名单、没有新的申报入口就打到 50 分以下；达到 50 分时仍要写一段解读，点出在推的方向，以及正文里出现的企业或产品。",
  "体检、租车、车辆租用、表彰、招租，以及和软件、数改无关的行政公告，打到 50 分以下，reading 留空。",
  "50 分及以上且确实有关时，reading 只写一段中文，供政策卡片使用。新产品、新技术、产品目录类通知以【附件摘录】里的产品条目为情报主体。不要只写「发布了多少项」或复述概述。一段话里点出两三条对得上的代表性政府侧产品和场景，写明产品或技术名称、研发单位和场景，名称以附件原文为准，不要编造。服务器、芯片、周界防护和纯视觉安防可以一句带过，不要当成主体。更全的简介、意向市场、价格和联系方式留在正文里。不要写成奖补摘要，不要写小标题，不要用「做这个场景里的软件助手」或「地域是某地」这类套话。",
  "subsidy、participation、threshold、contact、window 只有正文写明才填，没有就空字符串。奖补、申报入口、门槛和联络人放在这些字段，留给对话，不要堆进 reading。不要编造联络人、电话和金额。",
  "正文末尾的【附件摘录】来自通知 PDF。目录类通知以这些产品条目为情报主体，不要只看开头概述。验收名单里的企业名称也要读。",
  "跨行业目录若在概述里点到汽车、机器人或具身，但主体包含知识库、智能体、数字员工或软件产品，按这些软件内容评估，不要仅因点到硬件类别就打到 50 分以下。",
  "结合正文判断，不要只看标题。items 必须覆盖每条 url，url 原样复制。",
].join("\n");

export type PolicyAssessment = {
  score: number;
  reason: string;
  reading: string;
  subsidy: string;
  participation: string;
  threshold: string;
  contact: string;
  window: string;
};

function splitSentences(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  return compact
    .split(/(?<=[。！？])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** 本地套话或「地域是某地」整句。不能当政策卡片的解读。 */
export function isTemplateSentence(sentence: string): boolean {
  const text = sentence.trim();
  return Boolean(text) && (TEMPLATE_SENTENCE.test(text) || REGION_ONLY.test(text));
}

/** 整段都是套话时，不能入库，也不能显示在卡片上。 */
export function isTemplateReading(text: string | null | undefined): boolean {
  const parts = splitSentences(text ?? "");
  return parts.length === 0 || parts.every((part) => isTemplateSentence(part));
}

const PLACEHOLDER_SUMMARY = /信源回看约|列表页骨架|分数是价值分|分数是骨架分|种子线索|启发式/;

/** 政策行还没有模型写成的解读时，下一次回看可以再读正文。已有可用解读的不再占用名额。 */
export function leadNeedsAgentReading(input: {
  studio_angle?: string | null;
  opportunity_note?: string | null;
  summary?: string | null;
}): boolean {
  const angle = input.studio_angle?.trim() ?? "";
  const opportunity = input.opportunity_note?.trim() ?? "";
  if (angle && !isTemplateReading(angle)) return false;
  if (opportunity && !isTemplateReading(opportunity)) return false;
  const summary = input.summary?.trim() ?? "";
  if (summary && !PLACEHOLDER_SUMMARY.test(summary) && !isTemplateReading(summary)) return false;
  return true;
}

/** 只有模型给出的、高于阈值的一段解读才能写入政策页。 */
export function acceptPolicyAssessment(input: { score: number; reading: string | null | undefined }): boolean {
  const reading = input.reading?.replace(/\s+/g, " ").trim() ?? "";
  if (!reading || isTemplateReading(reading)) return false;
  if (!Number.isFinite(input.score) || input.score < RELEVANCE_THRESHOLD) return false;
  return true;
}
