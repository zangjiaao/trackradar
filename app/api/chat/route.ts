import { createOpenAI } from "@ai-sdk/openai";
import { env } from "cloudflare:workers";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { buildRuntimeContext } from "@/lib/agent-context";
import { openAiChatReasoningOptions } from "@/lib/chat-reasoning";
import { leadBrief } from "@/lib/lead-brief";
import { fetchPageMarkdown } from "@/lib/fetch-page-markdown";
import { CHAT_TOOL_STEPS, PROMPT_V1, TOOL_ADDENDUM } from "@/lib/prompt";
import { getDb } from "@/lib/db";
import { saveOpportunity } from "@/lib/opportunities";
import { getActivePrompt, listLeads, listTracks, searchSources } from "@/lib/queries";
import { readModelConfig, readTavilyApiKey } from "@/lib/settings";
import { webSearch } from "@/lib/web-search";
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
  const reasoning = openAiChatReasoningOptions(modelEnv.model, modelEnv.baseURL);

  const result = streamText({
    model: provider.chat(modelEnv.model),
    system: `${system}\n\n${TOOL_ADDENDUM}`,
    messages: await convertToModelMessages(body.messages),
    stopWhen: stepCountIs(CHAT_TOOL_STEPS),
    providerOptions: reasoning ? { openai: reasoning } : undefined,
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
        description:
          "读取数据库里当前的政策和案例。回答依赖这份清单时使用，不需要新鲜数据时不必调用。返回相关性分、机会、福利、如何参与、门槛、联络人；案例返回价格信号、看到的内容和能力关系。低分过滤的候选不在这里。每条保留 url。省略 kind 时两侧都看。",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(30).optional().describe("返回条数，默认 15"),
          kind: z.enum(["policy", "case"]).optional().describe("policy 只看政策，case 只看案例，省略则两侧都看"),
          keyword: z.string().optional().describe("按标题、解读、福利、门槛、联络人或案例信号检索"),
        }),
        execute: async ({ limit, kind, keyword }) => {
          try {
            const leads = (await listLeads(limit ?? 15, null, kind, keyword)).map(leadBrief);
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
        description:
          "到已启用的政策信源回看大约一年。只有确实要新爬门户时使用。先采集标题、时间和正文，通知页的 PDF 附件会抽进正文。同一列表会翻后续页，直到超出回看窗口。有模型时按政府在用、在采的产品写一段解读，方便定 demo；无关的不进政策页。没有密钥时不写入政策页。不翻全站。执行过程记在任务页。",
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
      web_search: tool({
        description:
          "在互联网上搜索公开信息，只返回标题、链接和短摘要。库内政策或案例不够、或用户明确要查网上最新信息时使用。不要用它代替 scan_sources，也不要搜索猪八戒、Fiverr 等人工案例站。要读某一条结果的正文时，再用 fetch_page_markdown。",
        inputSchema: z.object({
          query: z.string().describe("搜索词，例如 宁波 人工智能 奖补 2026"),
          max_results: z.number().int().min(1).max(10).optional().describe("返回条数，默认 5，最多 10"),
        }),
        execute: async ({ query, max_results }) => {
          const found = await webSearch({ query, maxResults: max_results, apiKey: await readTavilyApiKey() });
          const brief = query.trim().replace(/\s+/g, " ").slice(0, 80);
          if (!found.ok) {
            await recordWork({ kind: "tool_web_search", status: "failed", message: `联网搜索失败：${found.error}` });
            return { error: found.error, query };
          }
          await recordWork({
            kind: "tool_web_search",
            status: "done",
            message: `联网搜索：${brief || "（空）"}，${found.results.length} 条。`,
          });
          return { query: found.query, results: found.results };
        },
      }),
      fetch_page_markdown: tool({
        description:
          "把一条 http(s) 网页用浏览器转成 Markdown。用来补读库里留空的政策字段，或深读 web_search 找到的某一条原链。一次只打开一个链接。不要用它爬猪八戒、Fiverr 等人工案例站，也不要代替 list_leads 或 scan_sources。",
        inputSchema: z.object({
          url: z.string().describe("政策或通知的原始 http(s) 链接"),
        }),
        execute: async ({ url }) => {
          const page = await fetchPageMarkdown(url, env.BROWSER);
          if (!page.ok) {
            await recordWork({ kind: "tool_fetch_page_markdown", status: "failed", message: `打开原文失败：${page.error}` });
            return { error: page.error, url: page.url ?? url };
          }
          await recordWork({
            kind: "tool_fetch_page_markdown",
            status: "done",
            message: `Agent 打开原文${page.truncated ? "（已截断）" : ""}：${page.url}`,
          });
          return {
            url: page.url,
            title: page.title,
            truncated: page.truncated,
            markdown: page.markdown,
          };
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

  // 推理留在模型侧。页面只渲染正文，不把 chain-of-thought 流进对话气泡。
  return result.toUIMessageStreamResponse({ sendReasoning: false });
}
