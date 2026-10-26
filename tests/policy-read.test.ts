import assert from "node:assert/strict";
import test from "node:test";
import { readPolicy } from "../lib/policy-read.ts";
import { PROMPT_V1 } from "../lib/prompt.ts";

test("服务商资源池会写出相关片段和机会", () => {
  const reading = readPolicy("关于征集人工智能应用服务商资源池的通知");
  assert.equal(reading.keep, true);
  assert.deepEqual(reading.tracks, ["T10"]);
  assert.match(reading.excerpt, /资源池/);
  assert.doesNotMatch(reading.summary, /与\s*T10|与T10/);
  assert.match(reading.opportunity, /入库|资源池/);
  assert.doesNotMatch(reading.opportunity, /做个 demo|demo 或申报/);
});

test("只有园区或入库纳统时不入库", () => {
  assert.equal(readPolicy("绿色工业园区推荐工作").reason, "broad");
  assert.equal(readPolicy("商贸企业入库纳统会议").reason, "broad");
});

test("智能体让政务标题变得可入库", () => {
  const reading = readPolicy("政务园区智能体入库");
  assert.equal(reading.keep, true);
  assert.equal(reading.tracks[0], "T08");
  assert.match(reading.opportunity, /demo|助手|软件/);
});

test("默认提示词要求解读政策并过滤过宽口径", () => {
  assert.match(PROMPT_V1, /T01–T10/);
  assert.match(PROMPT_V1, /不做汽车\/机器人等硬件/);
  assert.match(PROMPT_V1, /每条保留原链接/);
  assert.match(PROMPT_V1, /先解读/);
  assert.match(PROMPT_V1, /过宽口径/);
  assert.match(PROMPT_V1, /Fiverr/);
  assert.match(PROMPT_V1, /秀肌肉/);
  assert.match(PROMPT_V1, /UI\/UX/);
  assert.match(PROMPT_V1, /先接小单/);
  assert.match(PROMPT_V1, /有助于发展/);
});
