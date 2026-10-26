import { cadenceLabel } from "@/lib/collect";
import { SIDE_LABEL, type Side } from "@/lib/domain";
import { siteLabel } from "@/lib/opportunity-draft";
import { listLeads, listSources } from "@/lib/queries";
import { readMaterialSites, readPublicModel } from "@/lib/settings";
import { listTasks } from "@/lib/tasks";

/** 对话系统提示里附上的运行时快照：配置和最近机会，不含密钥。 */
export async function buildRuntimeContext(): Promise<string> {
  const [model, sources, leads, materialSites, tasks] = await Promise.all([
    readPublicModel(),
    listSources(),
    listLeads(8),
    readMaterialSites(),
    listTasks(),
  ]);
  const enabled = sources.filter((source) => source.enabled);
  const disabled = sources.filter((source) => !source.enabled);
  const lines = [
    "下面是用户当前配置和最近机会。分析时以此为准，不要另起一套假设。",
    `模型：${model.configured ? model.model : "未配置"}。${model.baseURL ? `网关 ${model.baseURL}。` : "未设置自定义 Base URL。"}`,
    tasks.length
      ? `定时任务：${tasks
          .map((task) => `${task.enabled ? "启用" : "停用"}｜${task.name}｜${cadenceLabel(task.cadence)}｜回看 ${task.lookback_days} 天`)
          .join("；")}。到点会按启用信源回看并写入机会清单。`
      : "定时任务：还没有。用户可以在任务页添加每天或每周一的回看。",
    `常用找素材站点：${materialSites} 这些条目由人工录入，用来分析现状。`,
    enabled.length
      ? `启用信源：${enabled.map((source) => `${source.region}·${source.name}`).join("、")}。`
      : "启用信源：无。",
    disabled.length ? `停用信源：${disabled.map((source) => `${source.region}·${source.name}`).join("、")}。` : "停用信源：无。",
    leads.length ? "最近机会：" : "最近机会：清单还是空的。",
    ...leads.map((lead) => {
      const side = lead.side && lead.side in SIDE_LABEL ? SIDE_LABEL[lead.side as Side] : "侧未知";
      const tracks = lead.track_codes.length ? lead.track_codes.join("、") : (lead.track_code ?? "未映射");
      return `- ${lead.title}｜赛道 ${tracks}｜${side}｜站点 ${siteLabel(lead.site)}｜${lead.region ?? "地域未知"}｜骨架分 ${lead.score_total ?? "—"}｜${lead.url}`;
    }),
  ];
  return lines.join("\n");
}
