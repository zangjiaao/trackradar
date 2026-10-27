import assert from "node:assert/strict";
import test from "node:test";
import {
  TAVILY_SEARCH_URL,
  WEB_SEARCH_DEFAULT_RESULTS,
  WEB_SEARCH_MAX_RESULTS,
  WEB_SEARCH_SNIPPET_LIMIT,
  clampSearchResults,
  mapTavilyStatus,
  normalizeTavilyKey,
  presentTavilyKey,
  webSearch,
} from "../lib/web-search.ts";

const KEY = "tvly-test-secret-key";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("条数默认 5，并夹到 1–10", () => {
  assert.equal(clampSearchResults(undefined), WEB_SEARCH_DEFAULT_RESULTS);
  assert.equal(clampSearchResults(Number.NaN), 5);
  assert.equal(clampSearchResults(0), 1);
  assert.equal(clampSearchResults(3.9), 3);
  assert.equal(clampSearchResults(99), WEB_SEARCH_MAX_RESULTS);
});

test("密钥展示只留末四位，配置页优先于环境变量", () => {
  const saved = presentTavilyKey("tvly-abcdefghij", "tvly-from-env-key");
  assert.equal(saved.configured, true);
  assert.equal(saved.from, "settings");
  assert.equal(saved.keyHint, "已保存，末四位 ghij");
  assert.equal(saved.keyHint?.includes("tvly-abcdefghij"), false);

  const fromEnv = presentTavilyKey("  ", "tvly-from-env-key");
  assert.equal(fromEnv.from, "env");
  assert.equal(fromEnv.keyHint, "使用环境变量 TAVILY_API_KEY");
  assert.equal(fromEnv.keyHint?.includes("tvly-from-env-key"), false);

  const missing = presentTavilyKey(undefined, "");
  assert.equal(missing.configured, false);
  assert.equal(missing.from, null);
});

test("密钥格式过短或含空白会被拒绝", () => {
  assert.equal(normalizeTavilyKey("  tvly-ok-key  ").ok, true);
  assert.match(normalizeTavilyKey("short").error ?? "", /格式/);
  assert.match(normalizeTavilyKey("tvly-bad key").error ?? "", /格式/);
  assert.match(normalizeTavilyKey("tvly-bad\nkey").error ?? "", /格式/);
});

test("未配置密钥时不请求 Tavily，并说明去哪里填", async () => {
  let called = false;
  const result = await webSearch({
    query: "宁波 人工智能 奖补",
    apiKey: "  ",
    fetch: async () => {
      called = true;
      return jsonResponse(200, { results: [] });
    },
  });
  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /未配置 Tavily 密钥/);
  if (!result.ok) assert.match(result.error, /配置页|TAVILY_API_KEY/);
});

test("空搜索词和过长搜索词直接失败", async () => {
  const empty = await webSearch({ query: "   ", apiKey: KEY, fetch: async () => jsonResponse(200, {}) });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /空的/);

  const long = await webSearch({ query: "甲".repeat(401), apiKey: KEY, fetch: async () => jsonResponse(200, {}) });
  assert.equal(long.ok, false);
  if (!long.ok) assert.match(long.error, /过长/);
});

test("请求固定 basic，默认 5 条，并只回标题、链接和短摘要", async () => {
  let seenUrl = "";
  let seenAuth = "";
  let seenBody = "";
  const html = `<p>${"补贴".repeat(300)}</p>`;
  const result = await webSearch({
    query: "  银川   智能体  ",
    apiKey: KEY,
    fetch: async (url, init) => {
      seenUrl = url;
      seenAuth = new Headers(init?.headers).get("authorization") ?? "";
      seenBody = String(init?.body ?? "");
      return jsonResponse(200, {
        answer: "整段答案不该返回",
        results: [
          {
            title: "银川通知",
            url: "https://gxj.yinchuan.gov.cn/notice",
            content: html,
            score: 0.9,
            raw_content: "<html>整页不该进上下文</html>",
          },
          { title: "ftp 丢掉", url: "ftp://files.example/a", content: "nope" },
        ],
      });
    },
  });

  assert.equal(seenUrl, TAVILY_SEARCH_URL);
  assert.equal(seenAuth, `Bearer ${KEY}`);
  const payload = JSON.parse(seenBody) as Record<string, unknown>;
  assert.equal(payload.query, "银川 智能体");
  assert.equal(payload.max_results, 5);
  assert.equal(payload.search_depth, "basic");
  assert.equal(payload.chunks_per_source, 1);
  assert.equal(payload.include_answer, false);
  assert.equal(payload.include_raw_content, false);
  assert.equal(payload.include_images, false);
  assert.equal(payload.auto_parameters, false);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.results.length, 1);
  assert.deepEqual(Object.keys(result.results[0]).sort(), ["snippet", "title", "url"]);
  assert.equal(result.results[0].url, "https://gxj.yinchuan.gov.cn/notice");
  assert.equal(result.results[0].snippet.length <= WEB_SEARCH_SNIPPET_LIMIT + 1, true);
  assert.match(result.results[0].snippet, /…$/);
  assert.equal(result.results[0].snippet.includes("<p>"), false);
  const packed = JSON.stringify(result);
  assert.equal(packed.includes("整页不该进上下文"), false);
  assert.equal(packed.includes("整段答案不该返回"), false);
  assert.equal(packed.includes(KEY), false);
});

test("max_results 超过 10 时请求夹到 10", async () => {
  let maxResults = 0;
  await webSearch({
    query: "杭州 知识库",
    maxResults: 40,
    apiKey: KEY,
    fetch: async (_url, init) => {
      maxResults = (JSON.parse(String(init?.body)) as { max_results: number }).max_results;
      return jsonResponse(200, { results: [] });
    },
  });
  assert.equal(maxResults, 10);
});

test("401、429、432 和超时映射成中文，且错误里没有密钥", async () => {
  const unauthorized = await webSearch({
    query: "深圳",
    apiKey: KEY,
    fetch: async () => jsonResponse(401, { detail: { error: `unauthorized ${KEY}` } }),
  });
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) {
    assert.match(unauthorized.error, /密钥无效/);
    assert.equal(unauthorized.error.includes(KEY), false);
    assert.equal(/tvly-/i.test(unauthorized.error), false);
  }

  const limited = await webSearch({
    query: "深圳",
    apiKey: KEY,
    fetch: async () => jsonResponse(429, { detail: { error: "rate limit" } }),
  });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.match(limited.error, /过于频繁/);

  const quota = await webSearch({
    query: "深圳",
    apiKey: KEY,
    fetch: async () => jsonResponse(432, { detail: { error: "plan limit" } }),
  });
  assert.equal(quota.ok, false);
  if (!quota.ok) assert.match(quota.error, /额度已用尽/);

  const leaked = mapTavilyStatus(500, JSON.stringify({ error: `upstream said ${KEY} Bearer ${KEY}` }), KEY);
  assert.match(leaked, /HTTP 500/);
  assert.equal(leaked.includes(KEY), false);
  assert.equal(/tvly-/i.test(leaked), false);

  const timedOut = await webSearch({
    query: "深圳",
    apiKey: KEY,
    fetch: async () => {
      throw new Error("The operation was aborted due to timeout");
    },
  });
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.match(timedOut.error, /超时/);
});
