import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { browserHeaders, readResponseText } from "../lib/browser-headers.ts";
import { extractListItems } from "../lib/extract-links.ts";
import { fetchPolicyList } from "../lib/fetch-list.ts";

const shell = `
  <a href="/col/col1/index.html" title="区（县、市）要闻">区（县、市）要闻</a>
  <script id="unit" url="/api-gateway/jpaas-publish-server/front/page/build/unit" queryData="{'parseType':'bulidstatic','webId':'3494','tplSetId':'abc','pageType':'column','tagId':'通知公告_分页列表','editType':'null','pageId':'1229578992'}"></script>
`;

const listHtml = `
  <a href="/art/2026/10/21/art_1229578992_1.html" title="关于开展2026年宁波市级人工智能OPC社区申报和绩效评价的通知">通知</a>
  <a href="/art/2026/3/21/art_1229578992_2.html" title="2026年宁波市算力券发放实施细则">细则</a>
  <a href="/art/2026/4/2/art_1229578992_3.html" title="关于符合宁波市算力政策支持范围的算力供给方名单公示">公示</a>
`;

test("栏目壳只有导航时，改读 jpaas 列表接口", async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetched = await fetchPolicyList("https://dsjj.ningbo.gov.cn/col/col1229578992/index.html", {
    maxPages: 1,
    fetch: async (input, init) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url.includes("jpaas-publish-server")) {
        return new Response(JSON.stringify({ data: { html: listHtml } }), { status: 200 });
      }
      return new Response(shell, { status: 200 });
    },
  });
  assert.equal(fetched.error, undefined);
  assert.equal(fetched.items.length, 3);
  assert.match(fetched.items[0]?.title ?? "", /OPC社区申报/);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.headers.get("user-agent") ?? "", /Chrome\/131/);
  assert.equal(calls[0]?.headers.get("accept-language"), "zh-CN,zh;q=0.9,en;q=0.8");
  assert.equal(calls[0]?.headers.get("sec-fetch-site"), "none");
  assert.equal(calls[1]?.headers.get("x-requested-with"), "XMLHttpRequest");
  assert.equal(calls[1]?.headers.get("referer"), "https://dsjj.ningbo.gov.cn/col/col1229578992/index.html");
  assert.equal(calls[1]?.headers.get("sec-fetch-site"), "same-origin");
  assert.match(calls[1]?.url ?? "", /pageId=1229578992/);
});

test("静态页已经有通知时不再请求列表接口", async () => {
  let calls = 0;
  const html = [
    '<a href="/cyfz/20261023/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html" title="关于印发人工智能行动方案的通知">通知</a>',
    '<a href="/cyfz/20261022/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.html" title="关于组织开展设计创新中心认定的通知">通知</a>',
    '<a href="/cyfz/20261021/cccccccccccccccccccccccccccccccc.html" title="关于征集制造业智能化储备项目的通知">通知</a>',
  ].join("");
  const fetched = await fetchPolicyList("https://www.sheitc.sh.gov.cn/cyfz/index.html", {
    maxPages: 1,
    fetch: async () => {
      calls += 1;
      return new Response(html, { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(fetched.items.length, 3);
});

test("卡片链接用内部标题，不把日期和摘要拼进去", () => {
  const html = `
    <a class="art_item" href="./202610/t20261027_2868780.html">
      <span class="art_day">27</span>
      <span class="art_month">2026-10</span>
      <span class="art_list_ttl" title="市经信局关于公开征求氢燃料电池汽车奖励办法意见的通知">标题</span>
      <span class="art_list_content">为加快推进燃料电池汽车推广应用，现面向社会公开征求意见。</span>
    </a>
  `;
  const items = extractListItems(html, "https://jxj.wuhan.gov.cn/xwzx_9/tztg/");
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "市经信局关于公开征求氢燃料电池汽车奖励办法意见的通知");
});

test("区县要闻这类短导航不进列表", () => {
  const html = '<a href="/col/col1/index.html" title="区（县、市）要闻">区（县、市）要闻</a>';
  assert.equal(extractListItems(html, "https://dsjj.ningbo.gov.cn/").length, 0);
});

test("声明了 gzip 时仍能读出正文", async () => {
  const bytes = gzipSync(Buffer.from("通知正文", "utf8"));
  const response = new Response(bytes, { headers: { "content-encoding": "gzip" } });
  assert.equal(await readResponseText(response), "通知正文");
});

test("正文请求带站点 Referer", () => {
  const headers = browserHeaders("https://jxj.beijing.gov.cn/jxdt/tzgg/202610/t20261001_1.html", {
    accept: "document",
    referer: "https://jxj.beijing.gov.cn/",
  });
  assert.equal(headers.get("referer"), "https://jxj.beijing.gov.cn/");
  assert.equal(headers.get("upgrade-insecure-requests"), "1");
  assert.match(headers.get("accept") ?? "", /text\/html/);
});
