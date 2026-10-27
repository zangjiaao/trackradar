import assert from "node:assert/strict";
import test from "node:test";
import {
  assessErrorReason,
  assessmentPrompt,
  assessmentsFromModelText,
  collectAssessments,
  type ScoreInput,
} from "../lib/policy-assess-json.ts";

const catalog = "https://gxj.xa.gov.cn/gzdt/tzgg/2110279543487565825.html";
const acceptance = "https://gxj.xa.gov.cn/gzdt/tzgg/2104492035763965953.html";

function item(url: string, title: string): ScoreInput {
  return { url, title, body: "正文里有知识库和智能体。", region: "西安", sourceName: "高新区门户" };
}

test("围栏 JSON 能解析，尾逗号和错位 url 也能对齐", () => {
  const fenced = [
    "```json",
    `{"items":[{"url":"${catalog}","score":"76","reason":"目录里有智能体","reading":"环境安全监测智能体由西安云阶智元研发，用于园区环境监测。","subsidy":"","participation":"","threshold":"","contact":"","window":"",}]}`,
    "```",
  ].join("\n");
  const parsed = assessmentsFromModelText(fenced, [catalog]);
  assert.equal(parsed.reason, undefined);
  assert.equal(parsed.byUrl.get(catalog)?.score, 76);
  assert.match(parsed.byUrl.get(catalog)?.reading ?? "", /西安云阶智元/);

  const shifted = assessmentsFromModelText(
    JSON.stringify({
      items: [
        { url: "", score: 61, reason: "验收名单", reading: "政府在推数字化改造，名单里有软件企业。", subsidy: "", participation: "", threshold: "", contact: "", window: "" },
        { url: "https://example.com/wrong", score: 80, reason: "目录", reading: "LiveKnowledge 由西安视途科技研发，做知识库问答。", subsidy: "", participation: "", threshold: "", contact: "", window: "" },
      ],
    }),
    [acceptance, catalog],
  );
  assert.equal(shifted.byUrl.size, 2);
  assert.match(shifted.byUrl.get(catalog)?.reading ?? "", /LiveKnowledge/);
  assert.equal(shifted.byUrl.get(acceptance)?.score, 61);
});

test("空返回、非法 JSON、没有条目会给出原因", () => {
  assert.equal(assessmentsFromModelText("  ", [catalog]).reason, "返回为空");
  assert.equal(assessmentsFromModelText("模型觉得都无关，先不给 JSON。", [catalog]).reason, "返回不是合法 JSON");
  assert.equal(assessmentsFromModelText('{"items":[]}', [catalog]).reason, "返回里没有条目");
});

test("失败原因只留短标签，不带密钥或响应正文", () => {
  const timeout = new Error("The operation was aborted due to timeout");
  timeout.name = "TimeoutError";
  assert.equal(assessErrorReason(timeout), "评估超时");
  const schema = Object.assign(new Error("request failed sk-live-should-not-appear"), {
    statusCode: 400,
    responseBody: "unsupported response_format json_schema",
  });
  assert.equal(assessErrorReason(schema), "接口不接受结构化输出");
  assert.equal(assessErrorReason({ statusCode: 502, message: "bad gateway sk-abc" }), "接口返回 502");
  assert.doesNotMatch(assessErrorReason(schema), /sk-/);
  assert.equal(assessErrorReason(new Error("socket hang up")), "评估失败");
});

test("聊天式返回能评上，超时不再被吞掉", async () => {
  const sizes: number[] = [];
  const timeouts: number[] = [];
  const ok = await collectAssessments({
    items: [item(catalog, "目录"), item(acceptance, "验收"), item("https://example.com/c", "第三条"), item("https://example.com/d", "第四条")],
    now: () => 0,
    deadline: 80_000,
    complete: async (batch, timeoutMs) => {
      sizes.push(batch.length);
      timeouts.push(timeoutMs);
      return JSON.stringify({
        items: batch.map((entry) => ({
          url: entry.url,
          score: 70,
          reason: "有关",
          reading: `${entry.title}里的知识库可用于政府侧软件场景。`,
          subsidy: "",
          participation: "",
          threshold: "",
          contact: "",
          window: "",
        })),
      });
    },
  });
  assert.deepEqual(sizes, [2, 2]);
  assert.ok(timeouts.every((timeout) => timeout >= 35_000));
  assert.equal(ok.mode, "agent");
  assert.equal(ok.note, undefined);
  assert.equal(ok.byUrl.size, 4);
  assert.match(ok.byUrl.get(catalog)?.reading ?? "", /目录/);

  let calls = 0;
  const failed = await collectAssessments({
    items: [item(catalog, "目录"), item(acceptance, "验收")],
    now: () => 0,
    deadline: 80_000,
    complete: async () => {
      calls += 1;
      const error = new Error("aborted sk-secret");
      error.name = "TimeoutError";
      throw error;
    },
  });
  assert.equal(calls, 1);
  assert.equal(failed.mode, "fallback");
  assert.equal(failed.note, "评估超时");
  assert.equal(failed.byUrl.size, 0);
  assert.doesNotMatch(failed.note ?? "", /sk-/);
});

test("一批解析失败会拆成单条再试，时间用尽则写明原因", async () => {
  const calls: number[] = [];
  const repaired = await collectAssessments({
    items: [item(catalog, "目录"), item(acceptance, "验收")],
    now: () => 0,
    deadline: 80_000,
    complete: async (batch) => {
      calls.push(batch.length);
      if (batch.length > 1) return "不是 JSON";
      return JSON.stringify({
        items: [{ url: batch[0]?.url, score: 66, reason: "有关", reading: "政府侧知识库产品可用于定 demo。", subsidy: "", participation: "", threshold: "", contact: "", window: "" }],
      });
    },
  });
  assert.deepEqual(calls, [2, 1, 1]);
  assert.equal(repaired.mode, "agent");
  assert.equal(repaired.byUrl.size, 2);

  let used = false;
  const starved = await collectAssessments({
    items: [item(catalog, "目录")],
    now: () => 5_000,
    deadline: 5_000,
    complete: async () => {
      used = true;
      return "{}";
    },
  });
  assert.equal(used, false);
  assert.equal(starved.mode, "fallback");
  assert.equal(starved.note, "评估时间不够");
});

test("评估提示走普通 JSON，不要求 json_schema", () => {
  const prompt = assessmentPrompt([item(catalog, "关于发布新产品新技术目录的通知")]);
  assert.match(prompt, /只返回一个 JSON 对象/);
  assert.match(prompt, new RegExp(catalog));
  assert.doesNotMatch(prompt, /json_schema/);
});
