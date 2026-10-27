import assert from "node:assert/strict";
import test from "node:test";
import type { LeadRow } from "../lib/domain.ts";
import { leadBrief, leadBriefLine } from "../lib/lead-brief.ts";

function lead(partial: Partial<LeadRow> & Pick<LeadRow, "title" | "url" | "kind">): LeadRow {
  return {
    id: "1",
    source_id: null,
    track_code: null,
    summary: null,
    relevant_excerpt: null,
    opportunity_note: null,
    studio_angle: null,
    subsidy_note: null,
    participation_note: null,
    who_can_apply: null,
    contact_note: null,
    window_note: null,
    region: null,
    side: null,
    site: null,
    signal: null,
    source_name: null,
    published_at: null,
    track_codes: [],
    score_capability: null,
    score_funding: null,
    score_demand: null,
    score_policy: null,
    score_competition: null,
    score_demo: null,
    score_total: null,
    relevance_score: null,
    relevance_reason: null,
    origin: "agent",
    created_at: "2026-10-26T00:00:00.000Z",
    ...partial,
  };
}

test("政策简报带相关性分和解读字段", () => {
  const row = lead({
    kind: "policy",
    title: "第五批数改申报",
    url: "https://gxj.xa.gov.cn/example",
    track_codes: ["T09"],
    relevance_score: 74,
    relevance_reason: "软件数改",
    studio_angle: "帮企业做软件开发",
    subsidy_note: "核定投入不超过 50%",
    participation_note: "线上在数转系统提交",
    who_can_apply: "西安制造业中小企业",
    contact_note: "王阳 029-67098976",
  });
  const brief = leadBrief(row);
  assert.equal(brief.relevance_score, 74);
  assert.equal(brief.opportunity, "帮企业做软件开发");
  assert.equal(brief.subsidy, "核定投入不超过 50%");
  assert.equal(brief.participation, "线上在数转系统提交");
  assert.equal(brief.threshold, "西安制造业中小企业");
  assert.equal(brief.contact, "王阳 029-67098976");
  assert.equal(brief.signal, null);
  const line = leadBriefLine(row);
  assert.match(line, /相关性 74/);
  assert.match(line, /机会 帮企业做软件开发/);
  assert.match(line, /福利 核定投入不超过 50%/);
  assert.match(line, /参与 线上在数转系统提交/);
  assert.match(line, /门槛 西安制造业中小企业/);
  assert.match(line, /联络人 王阳 029-67098976/);
  assert.match(line, /https:\/\/gxj\.xa\.gov\.cn\/example/);
});

test("案例简报带信号和能力关系，不套申报字段", () => {
  const row = lead({
    kind: "case",
    title: "企业知识库问答界面",
    url: "https://www.fiverr.com/example/kb-ui",
    signal: "预算 800 美元",
    summary: "有人求购知识库界面",
    opportunity_note: "能做知识库的交付界面",
    subsidy_note: "不应出现",
    contact_note: "不应出现",
  });
  const brief = leadBrief(row);
  assert.equal(brief.signal, "预算 800 美元");
  assert.equal(brief.seen, "有人求购知识库界面");
  assert.equal(brief.fit, "能做知识库的交付界面");
  assert.equal(brief.subsidy, null);
  assert.equal(brief.contact, null);
  const line = leadBriefLine(row);
  assert.match(line, /信号 预算 800 美元/);
  assert.match(line, /关系 能做知识库的交付界面/);
  assert.doesNotMatch(line, /福利/);
  assert.doesNotMatch(line, /联络人/);
});
