import { cadenceLabel } from "@/lib/collect";
import { SIDE_LABEL, type Side } from "@/lib/domain";
import { siteLabel } from "@/lib/opportunity-draft";
import { listLeads, listSources } from "@/lib/queries";
import { readCollectConfig, readMaterialSites, readPublicModel } from "@/lib/settings";

/** 对话系统提示里附上的运行时快照：配置和最近机会，不含密钥。 */
export async function buildRuntimeContext(): Promise<string> {
  const [model, collect, sources, leads, materialSites] = await Promise.all([
    readPublicModel(),
    readCollectConfig(),
    listSources(),
    listLeads(8),
    readMaterialSites(),
  ]);
  const enabled = sources.filter((source) => source.enabled);
  const disabled = sources.filter((source) => !source.enabled);
  const lines = [
    "下面是用户当前配置和最近机会。分析时以此为准，不要另起一套假设。",
    `模型：${model.configured ? model.model : "未配置"}。${model.baseURL ? `网关 ${model.baseURL}。` : "未设置自定义 Base URL。"}`,
    `采集：${collect.enabled ? "已启用" : "已关闭"}，周期 ${cadenceLabel(collect.cadence)}。到点只写入任务记录，尚未自动抓取和 AI 筛选。`,
    `常用找素材站点：${materialSites} 这些条目由人工录入，用来分析现状。`,
    enabled.length
      ? `启用信源：${enabled.map((source) => `${source.region}·${source.name}`).join("、")}。`
      : "启用信源：无。",
    disabled.length ? `停用信源：${disabled.map((source) => `${source.region}·${source.name}`).join("、")}。` : "停用信源：无。",
    leads.length ? "最近机会：" : "最近机会：清单还是空的。",
    ...leads.map((lead) => {
      const side = lead.side && lead.side in SIDE_LABEL ? SIDE_LABEL[lead.side as Side] : "侧未知";
      return `- ${lead.title}｜赛道 ${lead.track_code ?? "未映射"}｜${side}｜站点 ${siteLabel(lead.site)}｜${lead.region ?? "地域未知"}｜骨架分 ${lead.score_total ?? "—"}｜${lead.url}`;
    }),
  ];
  return lines.join("\n");
}
