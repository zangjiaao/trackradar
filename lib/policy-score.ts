import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { assessmentInputText } from "@/lib/article-attachments";
import { ASSESS_INSTRUCTIONS, type PolicyAssessment } from "@/lib/policy-assess";
import { clampRelevance, type ScoreMode } from "@/lib/policy-collect";
import { readModelConfig } from "@/lib/settings";

const assessmentSchema = z.object({
  items: z.array(
    z.object({
      url: z.string(),
      score: z.number(),
      reason: z.string(),
      reading: z
        .string()
        .describe(
          "一段中文，给政策卡片。目录要点出两三条代表性条目的名称、研发单位和场景，不要只写发布了多少项。服务器和纯视觉安防一句带过。验收公示写政府在推什么、谁在做。不要写成奖补摘要。",
        ),
      subsidy: z.string().describe("正文写明的奖补，没有则空字符串。不要写进 reading。"),
      participation: z.string().describe("正文写明的参与路径，没有则空字符串。留给对话。"),
      threshold: z.string().describe("正文写明的门槛，没有则空字符串。留给对话。"),
      contact: z.string().describe("正文写明的联络人，没有则空字符串。不要编造。"),
      window: z.string().describe("正文写明的时间窗口，没有则空字符串。"),
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
            `正文: ${assessmentInputText(item.body)}`,
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
