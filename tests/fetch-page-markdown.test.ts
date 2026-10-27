import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_MARKDOWN_LIMIT,
  fetchPageMarkdown,
  mapBrowserStatus,
  mapBrowserThrown,
  parsePageUrl,
  truncateMarkdown,
  type MarkdownQuickAction,
} from "../lib/fetch-page-markdown.ts";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function browser(impl: MarkdownQuickAction["quickAction"]): MarkdownQuickAction {
  return { quickAction: impl };
}

test("只接受 http 和 https，并拒绝内网与账号", () => {
  assert.equal(parsePageUrl("https://gxj.yinchuan.gov.cn/notice").url, "https://gxj.yinchuan.gov.cn/notice");
  assert.equal(parsePageUrl("  http://example.com/a  ").url, "http://example.com/a");
  assert.match(parsePageUrl("").error, /缺少/);
  assert.match(parsePageUrl("ftp://example.com").error, /http 或 https/);
  assert.match(parsePageUrl("javascript:alert(1)").error, /http 或 https/);
  assert.match(parsePageUrl("https://user:pass@example.com/a").error, /账号或密码/);
  assert.match(parsePageUrl("http://127.0.0.1/admin").error, /内网/);
  assert.match(parsePageUrl("http://localhost/page").error, /内网/);
  assert.match(parsePageUrl("http://192.168.1.8/page").error, /内网/);
  assert.match(parsePageUrl("notaurl").error, /有效/);
});

test("过长正文截断并注明", () => {
  const exact = "甲".repeat(PAGE_MARKDOWN_LIMIT);
  assert.deepEqual(truncateMarkdown(exact), { markdown: exact, truncated: false });
  const long = "乙".repeat(PAGE_MARKDOWN_LIMIT + 20);
  const clipped = truncateMarkdown(long);
  assert.equal(clipped.truncated, true);
  assert.match(clipped.markdown, /正文已截断/);
  assert.equal(clipped.markdown.includes("乙".repeat(PAGE_MARKDOWN_LIMIT + 1)), false);
  assert.equal(clipped.markdown.startsWith("乙".repeat(PAGE_MARKDOWN_LIMIT)), true);
});

test("错误映射覆盖额度、422、超时和非 2xx", () => {
  assert.match(mapBrowserStatus(429, "Browser time limit exceeded"), /429/);
  assert.match(mapBrowserStatus(422, "unprocessable"), /422/);
  assert.match(mapBrowserStatus(422, "Navigation timeout"), /超时/);
  assert.match(mapBrowserStatus(504, ""), /超时/);
  assert.match(mapBrowserStatus(500, "nope"), /HTTP 500/);
  assert.match(mapBrowserThrown(new Error('The RPC receiver does not implement the method "quickAction"')), /remote: true/);
  assert.match(mapBrowserThrown(new Error("The operation was aborted due to timeout")), /超时/);
});

test("绑定缺失和失败响应返回清晰错误，不调用真实浏览器", async () => {
  const missing = await fetchPageMarkdown("https://example.com/a", undefined);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /未配置 Browser/);

  const limited = await fetchPageMarkdown(
    "https://example.com/a",
    browser(async () => jsonResponse(429, { success: false, errors: [{ message: "Browser time limit exceeded for today" }] })),
  );
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.match(limited.error, /429/);

  const rejected = await fetchPageMarkdown(
    "https://example.com/a",
    browser(async () => jsonResponse(422, { success: false, errors: [{ message: "HTML to markdown failed", code: 2012 }] })),
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.error, /422/);

  const down = await fetchPageMarkdown("https://example.com/a", browser(async () => new Response("bad gateway", { status: 502 })));
  assert.equal(down.ok, false);
  if (!down.ok) assert.match(down.error, /HTTP 502/);
});

test("成功时返回 Markdown，并截断过长正文", async () => {
  let seen = "";
  const page = await fetchPageMarkdown(
    "https://example.com/notice",
    browser(async (_action, options) => {
      seen = options.url;
      return jsonResponse(200, {
        success: true,
        result: "# 通知\n\n奖补不超过 50%。",
        meta: { status: 200, title: "通知" },
      });
    }),
  );
  assert.equal(seen, "https://example.com/notice");
  assert.equal(page.ok, true);
  if (page.ok) {
    assert.equal(page.title, "通知");
    assert.equal(page.truncated, false);
    assert.match(page.markdown, /奖补不超过 50%/);
  }

  const huge = await fetchPageMarkdown(
    "https://example.com/long",
    browser(async () =>
      jsonResponse(200, {
        success: true,
        result: "丙".repeat(PAGE_MARKDOWN_LIMIT + 50),
        meta: { status: 200, title: "长文" },
      }),
    ),
  );
  assert.equal(huge.ok, true);
  if (huge.ok) {
    assert.equal(huge.truncated, true);
    assert.match(huge.markdown, /正文已截断/);
  }
});

test("成功标志为假或正文为空时不把空串当正文", async () => {
  const failed = await fetchPageMarkdown(
    "https://example.com/a",
    browser(async () => jsonResponse(200, { success: false, errors: [{ message: "page crashed" }] })),
  );
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error, /page crashed/);

  const empty = await fetchPageMarkdown(
    "https://example.com/a",
    browser(async () => jsonResponse(200, { success: true, result: "  \n", meta: { title: "" } })),
  );
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /没有可读正文/);
});
