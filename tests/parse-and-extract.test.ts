import assert from "node:assert/strict";
import test from "node:test";
import { extractListItems } from "../lib/extract-links";
import { parsePastedSamples } from "../lib/parse-sample";
import { PROMPT_V1 } from "../lib/prompt";
import { skeletonScores } from "../lib/scoring";

test("粘贴文本抽出标题和链接", () => {
  const text = [
    "企业知识库 RAG 搭建",
    "https://www.goofish.com/item?id=123",
    "¥2999",
    "",
    "[政务智能体方案](https://example.com/gov)",
  ].join("\n");
  const items = parsePastedSamples(text);
  assert.equal(items.length, 2);
  const pasted = items.find((item) => item.url.includes("goofish.com"));
  const markdown = items.find((item) => item.url === "https://example.com/gov");
  assert.equal(pasted?.title, "企业知识库 RAG 搭建");
  assert.equal(pasted?.price_or_signal, "¥2999");
  assert.equal(pasted?.track_guess, "T01");
  assert.equal(markdown?.track_guess, "T08");
});

test("列表页在条目足够时丢掉导航", () => {
  const html = [
    '<a href="/gjzfxxgktl/index.html" title="政府信息公开依据">政府信息公开依据</a>',
    '<a href="/cyfz/20261023/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html" title="关于印发人工智能行动方案的通知">通知</a>',
    '<a href="/cyfz/20261022/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.html" title="关于组织开展设计创新中心认定的通知">通知</a>',
    '<a href="/cyfz/20261021/cccccccccccccccccccccccccccccccc.html" title="关于征集制造业智能化储备项目的通知">通知</a>',
  ].join("");
  const items = extractListItems(html, "https://www.sheitc.sh.gov.cn/cyfz/index.html");
  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.url.includes("/cyfz/2026")));
});

test("列表页锚点优先使用 title", () => {
  const html = `
    <a href="/cyfz/20261023/abc.html" title="上海市经济和信息化委员会关于印发人工智能行动方案的通知">
      <h2>上海市经济和信息化委员会关于印发人工智能行动方案的通知</h2>
    </a>
    <a href="/index.html" title="首页">首页</a>
  `;
  const items = extractListItems(html, "https://www.sheitc.sh.gov.cn/cyfz/index.html");
  assert.equal(items.length, 1);
  assert.equal(items[0]?.url, "https://www.sheitc.sh.gov.cn/cyfz/20261023/abc.html");
  assert.match(items[0]?.title ?? "", /人工智能行动方案/);
});

test("排除硬件方向", () => {
  const items = parsePastedSamples("机器人关节电机 https://example.com/robot");
  assert.equal(items[0]?.track_guess, null);
  assert.match(items[0]?.note ?? "", /排除方向/);
});

test("v1 提示词保留关键约束", () => {
  assert.match(PROMPT_V1, /T01–T10/);
  assert.match(PROMPT_V1, /不做汽车\/机器人等硬件/);
  assert.match(PROMPT_V1, /每条保留原链接/);
});

test("骨架分落在 0 到 100", () => {
  const score = skeletonScores("关于征集人工智能应用服务商资源池的通知", "T10");
  assert.ok(score.total > 0 && score.total <= 100);
});
