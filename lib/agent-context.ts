import { cadenceLabel } from "@/lib/collect";
import { formatValueScore, namedSide, namedSite } from "@/lib/lead-presentation";
import { listLeads, listSources } from "@/lib/queries";
import { readMaterialSites, readPublicModel } from "@/lib/settings";
import { listTasks } from "@/lib/tasks";

function leadLine(lead: Awaited<ReturnType<typeof listLeads>>[number], kindLabel: string): string {
  const tracks = lead.track_codes.length ? lead.track_codes.join("、") : (lead.track_code ?? "未映射");
  const place = namedSite(lead.site) ?? lead.source_name?.trim() ?? null;
  const angle = lead.studio_angle?.trim() || lead.opportunity_note?.trim() || null;
  const benefit = kindLabel === "政策" ? lead.subsidy_note?.trim() || null : null;
  const threshold = kindLabel === "政策" ? lead.who_can_apply?.trim() || null : null;
  const signal = kindLabel === "案例" ? lead.signal?.trim() || null : null;
  return `- ${[kindLabel, lead.title, `赛道 ${tracks}`, namedSide(lead.side), place, lead.region?.trim() || null, signal ? `信号 ${signal}` : null, formatValueScore(lead.score_total), angle ? `关系 ${angle}` : null, benefit ? `福利 ${benefit}` : null, threshold ? `门槛 ${threshold}` : null, lead.url].filter(Boolean).join("｜")}`;
}

/** 对话系统提示里附上的运行时快照：配置、最近政策和最近案例，不含密钥。 */
export async function buildRuntimeContext(): Promise<string> {
  const [model, sources, policies, cases, materialSites, tasks] = await Promise.all([
    readPublicModel(),
    listSources(),
    listLeads(6, null, "policy"),
    listLeads(6, null, "case"),
    readMaterialSites(),
    listTasks(),
  ]);
  const enabled = sources.filter((source) => source.enabled);
  const disabled = sources.filter((source) => !source.enabled);
  const lines = [
    "下面是用户当前配置、最近政策和最近案例。分析时以此为准，不要另起一套假设。",
    `模型：${model.configured ? model.model : "未配置"}。${model.baseURL ? `网关 ${model.baseURL}。` : "未设置自定义 Base URL。"}`,
    tasks.length
      ? `定时任务：${tasks
          .map((task) => `${task.enabled ? "启用" : "停用"}｜${task.name}｜${cadenceLabel(task.cadence)}｜回看 ${task.lookback_days} 天`)
          .join("；")}。到点会按启用信源回看并写入政策。`
      : "定时任务：还没有。用户可以在任务页添加每天或每周一的回看。",
    `常用找素材站点：${materialSites} 这些条目由人工录入到案例，用来和市场对照。`,
    enabled.length
      ? `启用信源：${enabled.map((source) => `${source.region}·${source.name}`).join("、")}。`
      : "启用信源：无。",
    disabled.length ? `停用信源：${disabled.map((source) => `${source.region}·${source.name}`).join("、")}。` : "停用信源：无。",
    policies.length ? "最近政策：" : "最近政策：还没有。",
    ...policies.map((lead) => leadLine(lead, "政策")),
    cases.length ? "最近案例：" : "最近案例：还没有。问行动建议时说明案例侧是空的。",
    ...cases.map((lead) => leadLine(lead, "案例")),
  ];
  return lines.join("\n");
}
