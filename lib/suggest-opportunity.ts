import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { exclusionNote } from "@/lib/guess";
import { sortTrackCodes } from "@/lib/lead-tracks";
import { applySuggestedScores, heuristicDraft, normalizeSide, type OpportunityDraft } from "@/lib/opportunity-draft";
import { listTracks, loadTrackDictionaries } from "@/lib/queries";
import { readMaterialSites, readModelConfig } from "@/lib/settings";
import { recordWork } from "@/lib/work-log";

const TRACK_CODE = /^T(0[1-9]|10)$/;

const suggestionSchema = z.object({
  track_code: z.string().nullable(),
  track_codes: z.array(z.string()),
  side: z.enum(["demand", "supply", "content"]),
  summary: z.string(),
  region: z.string().nullable(),
  capability: z.number(),
  funding_window: z.number(),
  demand_density: z.number(),
  policy_heat: z.number(),
  competition: z.number(),
  demo_feasibility: z.number(),
  rationale: z.string(),
});

export type SuggestResult = Omit<OpportunityDraft, "mode"> & { mode: "heuristic" | "model" };

export async function suggestOpportunity(input: {
  title: string;
  notes?: string;
  site?: string;
  region?: string;
  url?: string;
}): Promise<SuggestResult> {
  const title = input.title.trim();
  const dictionaries = await loadTrackDictionaries();
  const base = heuristicDraft({ title, notes: input.notes, site: input.site, region: input.region, dictionaries });
  const modelEnv = await readModelConfig();
  if (!modelEnv) {
    await recordWork({ kind: "tool_suggest_opportunity", status: "done", message: `本地规则补全：${title}` });
    return base;
  }
  try {
    const [dictionary, sites] = await Promise.all([listTracks(), readMaterialSites()]);
    const provider = createOpenAI({ apiKey: modelEnv.apiKey, baseURL: modelEnv.baseURL });
    const { object } = await generateObject({
      model: provider.chat(modelEnv.model),
      schema: suggestionSchema,
      schemaName: "opportunity_suggestion",
      system: [
        "你协助把用户人工找到的一条外部素材填进机会表。",
        "一条素材可以同时属于多个赛道。track_codes 列出全部 T01–T10，track_code 填其中最具体的一个。没有命中时 track_codes 为空数组，track_code 为 null。",
        "汽车、机器人、具身智能硬件、芯片、服务器制造必须把 track_codes 设为空数组，track_code 设为 null。",
        "side 只能是 demand、supply、content。",
        "各分项是 0–100 的建议，不要计算总分。",
        "不要编造用户没有给出的链接，也不要声称已经爬取站点。",
        `赛道：${dictionary.map((track) => `${track.code} ${track.name}${track.keywords ? `（${track.keywords.replaceAll("\n", "、")}）` : ""}`).join("；")}`,
        `常用站点说明：${sites}`,
      ].join("\n"),
      prompt: [
        `标题：${title}`,
        `链接：${input.url?.trim() || "未提供"}`,
        `站点：${input.site?.trim() || "未提供"}`,
        `地域：${input.region?.trim() || "未提供"}`,
        `用户看到的内容：${input.notes?.trim() || "无"}`,
      ].join("\n"),
    });
    const excluded = exclusionNote(`${title}\n${input.notes ?? ""}`);
    const modelTrack = object.track_code && TRACK_CODE.test(object.track_code) ? object.track_code : null;
    const modelCodes = sortTrackCodes([...(object.track_codes ?? []), ...(modelTrack ? [modelTrack] : [])]);
    const chosen = excluded ? [] : modelCodes.length ? modelCodes : base.track_codes;
    const result: SuggestResult = {
      track_code: chosen[0] ?? null,
      track_codes: chosen,
      side: normalizeSide(object.side),
      summary: (object.summary || base.summary).trim().slice(0, 800),
      region: (object.region?.trim() || base.region || "").slice(0, 40) || null,
      scores: applySuggestedScores(
        {
          capability: object.capability,
          funding_window: object.funding_window,
          demand_density: object.demand_density,
          policy_heat: object.policy_heat,
          competition: object.competition,
          demo_feasibility: object.demo_feasibility,
        },
        base.scores,
      ),
      rationale: `${object.rationale} 分数已按默认权重重算，是排序建议，不是调研结论。`.slice(0, 500),
      mode: "model",
    };
    await recordWork({ kind: "tool_suggest_opportunity", status: "done", message: `模型补全：${title}` });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型补全失败";
    await recordWork({
      kind: "tool_suggest_opportunity",
      status: "failed",
      message: `${title}：${message}。已改用本地规则。`,
    });
    return { ...base, rationale: `${base.rationale} 模型没有返回可用建议，已改用本地规则。` };
  }
}
