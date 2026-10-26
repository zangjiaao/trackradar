import assert from "node:assert/strict";
import test from "node:test";
import { finalizeOpportunity, heuristicDraft } from "../lib/opportunity-draft.ts";

test("人工素材按标题建议赛道和需求侧", () => {
  const draft = heuristicDraft({
    title: "企业知识库 RAG 搭建",
    notes: "猪八戒上有人求购，预算面议",
    site: "zbj",
    region: "杭州",
  });
  assert.equal(draft.track_code, "T01");
  assert.equal(draft.side, "demand");
  assert.equal(draft.region, "杭州");
  assert.ok(draft.summary.includes("猪八戒"));
  assert.ok(draft.scores.total > 0 && draft.scores.total <= 100);
});

test("硬件方向不映射赛道", () => {
  const draft = heuristicDraft({ title: "机器人关节驱动方案", notes: "" });
  assert.equal(draft.track_code, null);
  assert.match(draft.summary, /排除/);
});

test("入库前收口链接、站点和排除方向", () => {
  const lead = finalizeOpportunity({
    title: "机器人关节驱动方案",
    url: "https://example.com/robot",
    site: "猪八戒",
    track_code: "T02",
    scores: {
      capability: 150,
      funding_window: -3,
      demand_density: 10,
      policy_heat: 10,
      competition: 10,
      demo_feasibility: 10,
    },
  });
  assert.equal(lead.track_code, null);
  assert.equal(lead.site, "zbj");
  assert.equal(lead.scores.capability, 100);
  assert.equal(lead.scores.funding_window, 0);
  assert.ok(lead.scores.total <= 100);
});

test("没有 http 链接时拒绝", () => {
  assert.throws(() => finalizeOpportunity({ title: "企业知识库", url: "javascript:alert(1)" }), /http/);
});
