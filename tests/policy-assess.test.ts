import assert from "node:assert/strict";
import test from "node:test";
import { ASSESS_INSTRUCTIONS, acceptPolicyAssessment, isTemplateReading, leadNeedsAgentReading } from "../lib/policy-assess.ts";

test("顺口提到大模型的新闻不能靠分数或套话入库", () => {
  assert.equal(
    acceptPolicyAssessment({
      score: 18,
      reading: "",
    }),
    false,
  );
  assert.equal(acceptPolicyAssessment({ score: 86, reading: "做这个场景里的软件助手，用来接交付。" }), false);
  assert.equal(acceptPolicyAssessment({ score: 74, reading: "地域是银川。" }), false);
  assert.equal(isTemplateReading("按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分。"), true);
});

test("模型写出的一段解读且达到阈值才入库", () => {
  assert.equal(
    acceptPolicyAssessment({
      score: 72,
      reading: "通知征集可验收的知识库产品，工作室可以做文档入库和问答。",
    }),
    true,
  );
  assert.equal(
    acceptPolicyAssessment({
      score: 49,
      reading: "通知征集可验收的知识库产品，工作室可以做文档入库和问答。",
    }),
    false,
  );
});

test("评估提示要求低相关新闻留空解读", () => {
  assert.match(ASSESS_INSTRUCTIONS, /顺口提到大模型/);
  assert.match(ASSESS_INSTRUCTIONS, /reading 留空/);
  assert.match(ASSESS_INSTRUCTIONS, /做这个场景里的软件助手/);
  assert.match(ASSESS_INSTRUCTIONS, /50 分及以上/);
  assert.match(ASSESS_INSTRUCTIONS, /验收公示/);
  assert.match(ASSESS_INSTRUCTIONS, /没有新的申报入口/);
  assert.match(ASSESS_INSTRUCTIONS, /体检、租车/);
  assert.match(ASSESS_INSTRUCTIONS, /【附件摘录】/);
  assert.match(ASSESS_INSTRUCTIONS, /不要仅因点到硬件类别就打到 50 分以下/);
  assert.match(ASSESS_INSTRUCTIONS, /政府已经采纳/);
  assert.match(ASSESS_INSTRUCTIONS, /不只是多收补贴通知/);
  assert.match(ASSESS_INSTRUCTIONS, /产品条目为情报主体/);
  assert.match(ASSESS_INSTRUCTIONS, /政府侧产品/);
  assert.match(ASSESS_INSTRUCTIONS, /政府在推什么、谁在做/);
  assert.match(ASSESS_INSTRUCTIONS, /不要写成奖补摘要/);
  assert.match(ASSESS_INSTRUCTIONS, /研发单位/);
  assert.match(ASSESS_INSTRUCTIONS, /不要只写「发布了多少项」/);
  assert.match(ASSESS_INSTRUCTIONS, /纯视觉安防/);
});

test("目录产品条目写成的一段解读可以入库", () => {
  assert.equal(
    acceptPolicyAssessment({
      score: 76,
      reading: "目录里有企业知识库 LiveKnowledge 和数字员工 LiveStaff，可对政府侧知识库和数字员工场景定 demo。",
    }),
    true,
  );
});

test("只有占位摘要的政策还可以再交给模型，已有解读的不再占名额", () => {
  assert.equal(
    leadNeedsAgentReading({
      summary: "信源回看约 365 天，映射 T09。分数是价值分，不是调研结论。",
      studio_angle: "",
      opportunity_note: "",
    }),
    true,
  );
  assert.equal(leadNeedsAgentReading({ summary: "地域是西安。", studio_angle: null, opportunity_note: null }), true);
  assert.equal(
    leadNeedsAgentReading({
      studio_angle: "帮西安制造业中小企业做第五批数改里的软件购买和申报。",
      summary: "核定投入不超过 50%。",
    }),
    false,
  );
});
