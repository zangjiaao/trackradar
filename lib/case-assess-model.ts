import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { readModelConfig } from "./settings";
import { CASE_ASSESS_SYSTEM, parseCaseAssessments, type CaseAssessor } from "./case-assess";

export async function createCaseAssessor(database: D1Database, instruction: string): Promise<CaseAssessor | null> {
  const config = await readModelConfig();
  if (!config) return null;
  const { results: tracks } = await database.prepare("SELECT code, name, summary, studio_fit FROM tracks ORDER BY sort_order")
    .all<{ code: string; name: string; summary: string; studio_fit: string }>();
  const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  return async (items, timeoutMs) => {
    const { text } = await generateText({
      model: provider.chat(config.model),
      system: CASE_ASSESS_SYSTEM,
      prompt: `现有赛道：${JSON.stringify(tracks)}\n任务补充要求（仅限上述软件范围内）：${instruction}\n待分析数据：${JSON.stringify(items)}\n只返回 {"items":[{"url":"原样复制","score":0,"reason":"判断依据","side":"supply","tracks":[],"summary":"","fit":"","signal":""}]}，覆盖每条链接。`,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return parseCaseAssessments(text, items, tracks.map((track) => track.code));
  };
}
