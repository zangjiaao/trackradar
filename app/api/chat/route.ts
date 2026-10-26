import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { readModelEnv } from "@/lib/db";
import { PROMPT_V1, TOOL_ADDENDUM } from "@/lib/prompt";
import { getActivePrompt, listLeads, listTracks, searchSources } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const modelEnv = readModelEnv();
  return Response.json({
    configured: Boolean(modelEnv),
    model: modelEnv?.model ?? "gpt-4o-mini",
    baseURL: Boolean(modelEnv?.baseURL),
  });
}

export async function POST(request: Request) {
  const modelEnv = readModelEnv();
  if (!modelEnv) {
    return Response.json(
      {
        error: "未配置模型密钥。请在项目根目录的 .dev.vars 写入 OPENAI_API_KEY 后重启开发服务器。可选：OPENAI_BASE_URL、OPENAI_MODEL。",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { messages?: UIMessage[] } | null;
  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: "请求体需要 messages 数组。" }, { status: 400 });
  }

  let system = PROMPT_V1;
  try {
    const profile = await getActivePrompt();
    if (profile?.system_prompt) system = profile.system_prompt;
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取提示词失败";
    system = `${PROMPT_V1}\n\n（本地数据库暂不可用：${message}。先按 v1 提示词回答，并说明数据未连上。）`;
  }

  const provider = createOpenAI({
    apiKey: modelEnv.apiKey,
    baseURL: modelEnv.baseURL,
  });

  const result = streamText({
    model: provider.chat(modelEnv.model),
    system: `${system}\n\n${TOOL_ADDENDUM}`,
    messages: await convertToModelMessages(body.messages),
    stopWhen: stepCountIs(4),
    tools: {
      list_tracks: tool({
        description: "列出赛道词典 T01–T10，含工作室契合说明。",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return { tracks: await listTracks() };
          } catch (error) {
            return { error: error instanceof Error ? error.message : "读取赛道失败" };
          }
        },
      }),
      list_leads: tool({
        description: "列出已入库线索。每条都带原始 url，回答时必须保留链接。",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(30).optional().describe("返回条数，默认 15"),
        }),
        execute: async ({ limit }) => {
          try {
            return { leads: await listLeads(limit ?? 15) };
          } catch (error) {
            return { error: error instanceof Error ? error.message : "读取线索失败" };
          }
        },
      }),
      search_sources: tool({
        description: "查询政策信源种子。fetch 为 true 时对最多 2 个列表页做通用抓取预览，不写入数据库。",
        inputSchema: z.object({
          region: z.string().optional().describe("地域关键词，如上海、北京"),
          keyword: z.string().optional().describe("信源名称或备注关键词"),
          fetch: z.boolean().optional().describe("是否试抓列表页"),
        }),
        execute: async (input) => {
          try {
            return await searchSources(input);
          } catch (error) {
            return { error: error instanceof Error ? error.message : "查询信源失败" };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
