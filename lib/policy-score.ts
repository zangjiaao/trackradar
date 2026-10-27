import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { clampRelevance, type ScoreMode } from "@/lib/policy-collect";
import { readModelConfig } from "@/lib/settings";

const ratingSchema = z.object({
  ratings: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      reason: z.string(),
    }),
  ),
});

export type ScoreInput = {
  url: string;
  title: string;
  body: string | null;
  region: string;
  sourceName: string;
};

export type ScoreBatch = {
  mode: ScoreMode;
  byUrl: Map<string, { score: number; reason: string }>;
};

/** 一批候选各打一个分。没有密钥或模型失败时，调用方改用本地规则。 */
export async function scoreCandidatesWithAgent(items: ScoreInput[]): Promise<ScoreBatch> {
  const empty: ScoreBatch = { mode: "local", byUrl: new Map() };
  if (items.length === 0) return empty;
  const modelEnv = await readModelConfig();
  if (!modelEnv) return empty;
  try {
    const provider = createOpenAI({ apiKey: modelEnv.apiKey, baseURL: modelEnv.baseURL });
    const { object } = await generateObject({
      model: provider.chat(modelEnv.model),
      schema: ratingSchema,
      schemaName: "policy_relevance",
      abortSignal: AbortSignal.timeout(20_000),
      system: [
        "你给已经入库的政策候选逐条打相关性分。",
        "工作室做智能体、知识库、FDE，以及软件向的人工智能和数字化改造。不做汽车、机器人、具身智能硬件、芯片、服务器制造。",
        "分数是 0 到 100 的整数。50 分及以上才值得进入政策清单。",
        "结合正文判断，不要只看标题，也不要因为标题没有对上某个赛道词就打低分。",
        "只有中小企业、园区、政务、入库这类过宽口径、又没有软件或智能体切口的，打到 50 分以下。",
        "reason 用一句中文说明。ratings 必须覆盖每条 url，url 原样复制。",
      ].join("\n"),
      prompt: items
        .map((item, index) =>
          [
            `#${index + 1}`,
            `url: ${item.url}`,
            `出处: ${item.region} ${item.sourceName}`,
            `标题: ${item.title}`,
            `正文: ${(item.body ?? "未读到正文").slice(0, 1800)}`,
          ].join("\n"),
        )
        .join("\n\n"),
    });
    const byUrl = new Map<string, { score: number; reason: string }>();
    for (const rating of object.ratings) {
      const url = rating.url.trim();
      if (!url || byUrl.has(url)) continue;
      byUrl.set(url, {
        score: clampRelevance(rating.score),
        reason: rating.reason.replace(/\s+/g, " ").trim().slice(0, 180) || "模型给出了相关性分。",
      });
    }
    return { mode: "agent", byUrl };
  } catch {
    return { mode: "fallback", byUrl: new Map() };
  }
}
