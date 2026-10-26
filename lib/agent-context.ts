import { cadenceLabel } from "@/lib/collect";
import { listLeads, listSamples, listSources } from "@/lib/queries";
import { PLATFORM_LABEL, type Platform } from "@/lib/domain";
import { readCollectConfig, readPublicModel } from "@/lib/settings";

/** 对话系统提示里附上的运行时快照：配置和最近机会，不含密钥。 */
export async function buildRuntimeContext(): Promise<string> {
  const [model, collect, sources, leads, samples] = await Promise.all([
    readPublicModel(),
    readCollectConfig(),
    listSources(),
    listLeads(8),
    listSamples(5),
  ]);
  const enabled = sources.filter((source) => source.enabled);
  const disabled = sources.filter((source) => !source.enabled);
  const lines = [
    "下面是用户当前配置和最近机会。分析时以此为准，不要另起一套假设。",
    `模型：${model.configured ? model.model : "未配置"}。${model.baseURL ? `网关 ${model.baseURL}。` : "未设置自定义 Base URL。"}`,
    `采集：${collect.enabled ? "已启用" : "已关闭"}，周期 ${cadenceLabel(collect.cadence)}。到点只写入任务记录，尚未自动抓取和 AI 筛选。`,
    enabled.length
      ? `启用信源：${enabled.map((source) => `${source.region}·${source.name}`).join("、")}。`
      : "启用信源：无。",
    disabled.length ? `停用信源：${disabled.map((source) => `${source.region}·${source.name}`).join("、")}。` : "停用信源：无。",
    leads.length ? "最近机会：" : "最近机会：清单还是空的。",
    ...leads.map(
      (lead) =>
        `- ${lead.title}｜赛道 ${lead.track_code ?? "未映射"}｜${lead.region ?? "地域未知"}｜骨架分 ${lead.score_total ?? "—"}｜${lead.url}`,
    ),
    samples.length ? "最近采样：" : "最近采样：无。",
    ...samples.map((sample) => {
      const platform = PLATFORM_LABEL[sample.platform as Platform] ?? sample.platform;
      return `- ${platform}｜${sample.title}｜${sample.url}`;
    }),
  ];
  return lines.join("\n");
}
