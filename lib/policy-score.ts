import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ASSESS_INSTRUCTIONS } from "@/lib/policy-assess";
import { assessmentPrompt, collectAssessments, type AssessBatch, type ScoreInput } from "@/lib/policy-assess-json";
import { readModelConfig } from "@/lib/settings";

export type { AssessBatch, ScoreInput };

/**
 * 用和对话相同的 chat completions 读正文并打分。
 * 不走 generateObject：兼容网关常拒绝 json_schema，而普通聊天是通的。
 * 两篇一批、失败原因写在 note 里，不再吞掉异常。
 */
export async function assessCandidatesWithAgent(items: ScoreInput[], options?: { deadline?: number }): Promise<AssessBatch> {
  const empty: AssessBatch = { mode: "local", byUrl: new Map() };
  if (items.length === 0) return empty;
  const modelEnv = await readModelConfig();
  if (!modelEnv) return empty;
  const provider = createOpenAI({ apiKey: modelEnv.apiKey, baseURL: modelEnv.baseURL });
  return collectAssessments({
    items,
    deadline: options?.deadline,
    complete: async (batch, timeoutMs) => {
      const { text } = await generateText({
        model: provider.chat(modelEnv.model),
        system: ASSESS_INSTRUCTIONS,
        prompt: assessmentPrompt(batch),
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxRetries: 0,
      });
      return text;
    },
  });
}
