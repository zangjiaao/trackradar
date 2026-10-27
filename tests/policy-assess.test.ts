import assert from "node:assert/strict";
import test from "node:test";
import { ASSESS_INSTRUCTIONS, acceptPolicyAssessment, isTemplateReading } from "../lib/policy-assess.ts";

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
});
