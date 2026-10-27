import assert from "node:assert/strict";
import test from "node:test";
import { policyCardReading, policyScoreLabel, type PolicyCardCopy } from "../lib/policy-card-copy.ts";

function lead(partial: Partial<PolicyCardCopy>): PolicyCardCopy {
  return {
    title: "通知标题",
    summary: null,
    relevant_excerpt: null,
    opportunity_note: null,
    studio_angle: null,
    subsidy_note: null,
    participation_note: null,
    who_can_apply: null,
    contact_note: null,
    window_note: null,
    ...partial,
  };
}

test("卡片只显示一段工作室解读，不拼福利、参与、门槛和联络人", () => {
  const reading = policyCardReading(
    lead({
      title: "第五批数字化改造",
      summary: "核定投入不超过 50%。二级≤30万。地域是西安。",
      studio_angle: "帮西安制造业中小企业做第五批数改里的软件开发，并协助准备奖补申报。",
      subsidy_note: "核定投入不超过 50%。二级≤30万。地域是西安。",
      participation_note: "线下10月30日前把申报材料交到辖区工信部门。",
      who_can_apply: "申报对象是西安制造业中小企业。",
      contact_note: "王阳 029-67098976",
      window_note: "线下 10月30日前 · 线上 11月3日前",
    }),
  );
  assert.equal(reading, "帮西安制造业中小企业做第五批数改里的软件开发，并协助准备奖补申报。");
  const catalog = policyCardReading(
    lead({
      studio_angle: "目录里有生产工艺知识图谱和环境安全监测智能体，可对知识库和智能体定 demo。",
      summary: "12 知识图谱 西安星图软件有限公司 面向生产工艺的知识检索。14 环境安全监测智能体 西安云阶智元信息科技有限公司 道路与校园安全监测。按需报价。",
      subsidy_note: "没有奖补。",
    }),
  );
  assert.equal(catalog, "目录里有生产工艺知识图谱和环境安全监测智能体，可对知识库和智能体定 demo。");
  assert.doesNotMatch(catalog ?? "", /西安星图软件有限公司/);
});

test("本地套话不进卡片", () => {
  assert.equal(policyCardReading(lead({ studio_angle: "做这个场景里的软件助手，用来接交付。" })), null);
  assert.equal(policyCardReading(lead({ summary: "地域是上海。", subsidy_note: "地域是上海。" })), null);
});

test("模板句和占位摘要不进卡片", () => {
  assert.equal(
    policyCardReading(
      lead({
        summary: "信源回看约 365 天，映射 T09。分数是价值分，不是调研结论。",
        studio_angle: "按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分。",
        subsidy_note: "地域是西安。",
      }),
    ),
    null,
  );
  const mixed = policyCardReading(
    lead({
      studio_angle: "帮企业做知识库入库。按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分。",
    }),
  );
  assert.equal(mixed, "帮企业做知识库入库。");
});

test("没有工作室解读时，用独立摘要，不用福利字段", () => {
  assert.equal(
    policyCardReading(
      lead({
        summary: "通知在征集可验收的知识库产品，工作室可以做文档入库和问答。",
        subsidy_note: "奖补不超过 20%。",
        contact_note: "王阳 029-67098976",
      }),
    ),
    "通知在征集可验收的知识库产品，工作室可以做文档入库和问答。",
  );
  assert.equal(
    policyCardReading(
      lead({
        summary: "核定投入不超过 50%。",
        subsidy_note: "核定投入不超过 50%。",
        participation_note: "线下10月30日前提交。",
        who_can_apply: "申报对象是西安制造业中小企业。",
        contact_note: "王阳 029-67098976",
        window_note: "线下 10月30日前",
      }),
    ),
    null,
  );
});

test("价值分在卡片上只留数字", () => {
  assert.deepEqual(policyScoreLabel(66.7), { text: "66.7", scored: true });
  assert.deepEqual(policyScoreLabel(65), { text: "65", scored: true });
  assert.deepEqual(policyScoreLabel(0), { text: "未评分", scored: false });
  assert.deepEqual(policyScoreLabel(null), { text: "未评分", scored: false });
});
