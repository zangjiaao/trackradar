import assert from "node:assert/strict";
import test from "node:test";
import {
  VALUE_SCORE_FORMULA,
  formatValueScore,
  leadWhen,
  namedSide,
  namedSite,
  presentReading,
  scoreBreakdown,
  sortLeads,
} from "../lib/lead-presentation.ts";

test("发布日优先用链接里的完整日期，没有则标发现", () => {
  const published = leadWhen({
    title: "关于组织开展资源池征集的通知",
    url: "https://jxj.beijing.gov.cn/zwgk/2024zcwj/202609/t20260918_4869487.html",
    published_at: null,
    created_at: "2026-10-26T02:00:00.000Z",
  });
  assert.equal(published.kind, "发布");
  assert.equal(published.label, "发布 2026-09-18");

  const stored = leadWhen({
    title: "没有日期的标题",
    url: "https://example.com/item",
    published_at: "2026-10-23",
    created_at: "2026-10-26T02:00:00.000Z",
  });
  assert.equal(stored.label, "发布 2026-10-23");

  const discovered = leadWhen({
    title: "只有年份的人工智能服务商通知",
    url: "https://example.com/notice",
    published_at: null,
    created_at: "2026-10-26T16:30:00.000Z",
  });
  assert.equal(discovered.kind, "发现");
  assert.equal(discovered.label, "发现 2026-10-27");
});

test("价值分按权重说明，0 或空显示未评分", () => {
  assert.match(VALUE_SCORE_FORMULA, /能力×25%/);
  assert.match(VALUE_SCORE_FORMULA, /资金×20%/);
  assert.match(VALUE_SCORE_FORMULA, /需求×20%/);
  assert.match(VALUE_SCORE_FORMULA, /政策×15%/);
  assert.match(VALUE_SCORE_FORMULA, /竞争×10%/);
  assert.match(VALUE_SCORE_FORMULA, /demo×10%/);
  assert.equal(formatValueScore(65), "价值分 65");
  assert.equal(formatValueScore(62.3), "价值分 62.3");
  assert.equal(formatValueScore(0), "未评分");
  assert.equal(formatValueScore(null), "未评分");
  assert.equal(
    scoreBreakdown({
      score_capability: 74,
      score_funding: 48,
      score_demand: 68,
      score_policy: 82,
      score_competition: 46,
      score_demo: 64,
    }),
    "能力 74×25% · 资金 48×20% · 需求 68×20% · 政策 82×15% · 竞争 46×10% · demo 64×10%",
  );
  assert.equal(scoreBreakdown({ score_capability: null, score_funding: 1, score_demand: 1, score_policy: 1, score_competition: 1, score_demo: 1 }), null);
});

test("空的侧和站点不生成占位", () => {
  assert.equal(namedSide(null), null);
  assert.equal(namedSide(""), null);
  assert.equal(namedSide("demand"), "需求");
  assert.equal(namedSite(null), null);
  assert.equal(namedSite("—"), null);
  assert.equal(namedSite("other"), null);
  assert.equal(namedSite("zbj"), "猪八戒");
});

test("占位摘要会按标题补上解读和机会，人工摘要保留", () => {
  const filled = presentReading({
    title: "关于征集人工智能应用服务商资源池的通知",
    summary: "信源回看约 365 天，映射 T10。分数是价值分，不是调研结论。",
    relevant_excerpt: null,
    opportunity_note: null,
  });
  assert.match(filled.opportunity ?? "", /资源池|入库/);
  assert.match(filled.summary ?? "", /T10/);
  assert.equal((filled.excerpt ?? "").includes("—"), false);

  const manual = presentReading({
    title: "企业知识库 RAG 搭建",
    summary: "来自猪八戒。有人求购知识库。",
    relevant_excerpt: null,
    opportunity_note: null,
  });
  assert.equal(manual.summary, "来自猪八戒。有人求购知识库。");
  assert.match(manual.opportunity ?? "", /知识库/);
});

test("默认按价值分从高到低，未评分沉底", () => {
  const rows = [
    { title: "低", url: "https://example.com/a", published_at: null, created_at: "2026-10-01T00:00:00.000Z", score_total: 40 },
    { title: "无", url: "https://example.com/b", published_at: null, created_at: "2026-10-03T00:00:00.000Z", score_total: 0 },
    { title: "高", url: "https://example.com/c", published_at: "2026-09-01", created_at: "2026-10-02T00:00:00.000Z", score_total: 80 },
  ];
  assert.deepEqual(
    sortLeads(rows, "score_desc").map((item) => item.title),
    ["高", "低", "无"],
  );
  assert.deepEqual(
    sortLeads(rows, "time_desc").map((item) => item.title),
    ["无", "低", "高"],
  );
});
