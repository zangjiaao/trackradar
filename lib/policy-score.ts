import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { ASSESS_INSTRUCTIONS, type PolicyAssessment } from "@/lib/policy-assess";
import { clampRelevance, type ScoreMode } from "@/lib/policy-collect";
import { readModelConfig } from "@/lib/settings";

const assessmentSchema = z.object({
  items: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      reason: z.string(),
      reading: z.string(),
      subsidy: z.string(),
      participation: z.string(),
      threshold: z.string(),
      contact: z.string(),
      window: z.string(),
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

export type AssessBatch = {
  mode: ScoreMode;
  byUrl: Map<string, PolicyAssessment>;
};

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** 一批候选交给模型：判断是否有关，并为有价值的写一段解读。没有密钥或失败时不编本地解读。 */
export async function assessCandidatesWithAgent(items: ScoreInput[]): Promise<AssessBatch> {
  const empty: AssessBatch = { mode: "local", byUrl: new Map() };
  if (items.length === 0) return empty;
  const modelEnv = await readModelConfig();
  if (!modelEnv) return empty;
  try {
    const provider = createOpenAI({ apiKey: modelEnv.apiKey, baseURL: modelEnv.baseURL });
    const { object } = await generateObject({
      model: provider.chat(modelEnv.model),
      schema: assessmentSchema,
      schemaName: "policy_assessment",
      abortSignal: AbortSignal.timeout(35_000),
      system: ASSESS_INSTRUCTIONS,
      prompt: items
        .map((item, index) =>
          [
            `#${index + 1}`,
            `url: ${item.url}`,
            `出处: ${item.region} ${item.sourceName}`,
            `标题: ${item.title}`,
            `正文: ${(item.body ?? "未读到正文").slice(0, 3200)}`,
          ].join("\n"),
        )
        .join("\n\n"),
    });
    const byUrl = new Map<string, PolicyAssessment>();
    for (const item of object.items) {
      const url = item.url.trim();
      if (!url || byUrl.has(url)) continue;
      byUrl.set(url, {
        score: clampRelevance(item.score),
        reason: clean(item.reason, 180) || "模型给出了相关性判断。",
        reading: clean(item.reading, 500),
        subsidy: clean(item.subsidy, 500),
        participation: clean(item.participation, 500),
        threshold: clean(item.threshold, 500),
        contact: clean(item.contact, 500),
        window: clean(item.window, 200),
      });
    }
    return { mode: "agent", byUrl };
  } catch {
    return { mode: "fallback", byUrl: new Map() };
  }
}
