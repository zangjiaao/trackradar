import { cadenceLabel } from "@/lib/collect";
import { leadBriefLine } from "@/lib/lead-brief";
import { listLeads, listSources } from "@/lib/queries";
import { readMaterialSites, readPublicModel } from "@/lib/settings";
import { listTasks } from "@/lib/tasks";

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
    "下面是这一轮请求开始时的配置、最近政策和最近案例，只作开场一瞥。用户说重新获取、又采了一遍、案例加了或再评估时，本轮立刻再调 list_leads，不要用这里或对话里更早的工具结果作数。",
    `模型：${model.configured ? model.model : "未配置"}。${model.baseURL ? `网关 ${model.baseURL}。` : "未设置自定义 Base URL。"}`,
    tasks.length
      ? `定时任务：${tasks
          .map((task) => `${task.enabled ? "启用" : "停用"}｜${task.name}｜${cadenceLabel(task.cadence)}｜回看 ${task.lookback_days} 天`)
          .join("；")}。到点会按启用信源回看并写入政策。`
      : "定时任务：还没有。用户可以在任务页添加每天或每周一的回看。",
    "确定方向和 demo 时，以本轮 list_leads 读到的清单为准。政策看相关性分、机会、目录条目、福利、参与、门槛和联络人；案例看价格信号和能力关系。低分过滤的候选不在这里。",
    `常用找素材站点：${materialSites} 这些条目由人工录入到案例，用来和市场对照。`,
    enabled.length
      ? `启用信源：${enabled.map((source) => `${source.region}·${source.name}`).join("、")}。`
      : "启用信源：无。",
    disabled.length ? `停用信源：${disabled.map((source) => `${source.region}·${source.name}`).join("、")}。` : "停用信源：无。",
    policies.length ? "最近政策：" : "最近政策：还没有。",
    ...policies.map((lead) => leadBriefLine(lead)),
    cases.length ? "最近案例：" : "最近案例：还没有。问行动建议时说明案例侧是空的。",
    ...cases.map((lead) => leadBriefLine(lead)),
  ];
  return lines.join("\n");
}
