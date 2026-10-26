import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { buildRuntimeContext } from "@/lib/agent-context";
import { PROMPT_V1, TOOL_ADDENDUM } from "@/lib/prompt";
import { getDb } from "@/lib/db";
import { saveOpportunity } from "@/lib/opportunities";
import { getActivePrompt, listLeads, listTracks, searchSources } from "@/lib/queries";
import { readModelConfig } from "@/lib/settings";
import { runSourceScan } from "@/lib/source-scan";
import { normalizeLookback } from "@/lib/source-window";
import { recordWork } from "@/lib/work-log";

export const dynamic = "force-dynamic";

export async function GET() {
  const modelEnv = await readModelConfig();
  return Response.json({
    configured: Boolean(modelEnv),
    model: modelEnv?.model ?? "gpt-4o-mini",
    baseURL: Boolean(modelEnv?.baseURL),
  });
}

export async function POST(request: Request) {
  const modelEnv = await readModelConfig();
  if (!modelEnv) {
    return Response.json(
      {
        error: "未配置模型密钥。请用右上角「配置」填写 API Key，或在 .dev.vars 写入 OPENAI_API_KEY。",
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
    const context = await buildRuntimeContext();
    system = `${system}\n\n${context}`;
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
    stopWhen: stepCountIs(5),
    tools: {
      list_tracks: tool({
        description: "列出赛道词典 T01–T10，含工作室契合说明。",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const tracks = await listTracks();
            await recordWork({ kind: "tool_list_tracks", status: "done", message: `Agent 读取赛道词典，共 ${tracks.length} 条。` });
            return { tracks };
          } catch (error) {
            const message = error instanceof Error ? error.message : "读取赛道失败";
            await recordWork({ kind: "tool_list_tracks", status: "failed", message });
            return { error: message };
          }
        },
      }),
      list_leads: tool({
        description: "列出政策和案例。kind 省略时两侧都返回。每条都带原始 url，回答时必须保留链接。",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(30).optional().describe("返回条数，默认 15"),
          kind: z.enum(["policy", "case"]).optional().describe("policy 只看政策，case 只看案例，省略则两侧都看"),
        }),
        execute: async ({ limit, kind }) => {
          try {
            const leads = await listLeads(limit ?? 15, null, kind);
            await recordWork({ kind: "tool_list_leads", status: "done", message: `Agent 读取${kind === "case" ? "案例" : kind === "policy" ? "政策" : "政策和案例"}，返回 ${leads.length} 条。` });
            return { leads };
          } catch (error) {
            const message = error instanceof Error ? error.message : "读取线索失败";
            await recordWork({ kind: "tool_list_leads", status: "failed", message });
            return { error: message };
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
            const result = await searchSources(input);
            const fetched = result.previews.map((preview) => preview.list_url).filter(Boolean);
            const names = result.sources.map((source) => `${source.region}·${source.name}`).slice(0, 8);
            const message = fetched.length
              ? `Agent 查询信源并试抓：${fetched.join("，")}`
              : `Agent 查询信源${names.length ? `：${names.join("、")}` : ""}，未抓取页面。`;
            await recordWork({ kind: "tool_search_sources", status: "done", message });
            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : "查询信源失败";
            await recordWork({ kind: "tool_search_sources", status: "failed", message });
            return { error: message };
          }
        },
      }),
      scan_sources: tool({
        description: "到已启用的政策信源回看大约一年的列表页。先解读，只把和工作室能力明显相关的政策写入政策页。能打开的通知再读这一篇正文，不翻全站。执行过程记在任务页。",
        inputSchema: z.object({
          lookback_days: z.number().int().min(30).max(800).optional().describe("回看天数，默认 365"),
          region: z.string().optional().describe("只看某个地域，如上海、北京"),
        }),
        execute: async ({ lookback_days, region }) => {
          try {
            const result = await runSourceScan(getDb(), {
              lookbackDays: normalizeLookback(lookback_days),
              trigger: "chat",
              region,
            });
            return {
              saved: result.saved,
              visited: result.visited,
              summary: result.summary,
              sources: result.sources.map((source) => ({
                region: source.region,
                name: source.name,
                status: source.status,
                fetched: source.fetched,
                saved: source.saved,
              })),
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "回看信源失败";
            await recordWork({ kind: "task_run", status: "failed", message });
            return { error: message };
          }
        },
      }),
      add_opportunity: tool({
        description: "把用户人工找到的一条市场素材写入案例。必须有标题和 http(s) 原链接。未给出的赛道、供需侧、摘要和分数用本地规则补全。不爬取站点。",
        inputSchema: z.object({
          title: z.string().describe("素材标题"),
          url: z.string().describe("原始 http(s) 链接"),
          site: z.string().optional().describe("站点代码或中文名：opc、zbj、fiverr、58、xhs、xianyu、taobao、channels、other"),
          notes: z.string().optional().describe("用户看到的求购、报价或笔记"),
          signal: z.string().optional().describe("价格或信号，例如预算 8000、面议"),
          region: z.string().optional(),
          track_code: z.string().optional().describe("主赛道 T01–T10，不确定就省略"),
          track_codes: z.array(z.string()).optional().describe("可多选的 T01–T10。不确定就省略，由本地规则判断全部命中"),
          side: z.enum(["demand", "supply", "content"]).optional(),
          summary: z.string().optional().describe("摘要解读：哪一部分相关"),
          relevant_excerpt: z.string().optional().describe("相关片段，引用原文"),
          opportunity_note: z.string().optional().describe("和智能体、知识库、FDE 的关系，不要写成申报流程"),
        }),
        execute: async (input) => {
          try {
            const saved = await saveOpportunity(input, "tool_add_opportunity");
            return {
              id: saved.id,
              title: saved.lead.title,
              url: saved.lead.url,
              track_code: saved.lead.track_code,
              track_codes: saved.lead.track_codes,
              side: saved.lead.side,
              site: saved.lead.site,
              region: saved.lead.region,
              summary: saved.lead.summary,
              relevant_excerpt: saved.lead.relevant_excerpt,
              opportunity_note: saved.lead.opportunity_note,
              score_total: saved.lead.scores.total,
              origin: "manual",
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "写入机会失败";
            await recordWork({ kind: "tool_add_opportunity", status: "failed", message });
            return { error: message };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
