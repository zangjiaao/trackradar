import assert from "node:assert/strict";
import test from "node:test";
import { clearCrawlJobs, formatWorkTime, presentWorkMessage } from "../lib/work-log-view.ts";

const xian =
  "西安·高新区门户：采集 8，评了 0，低分过滤 0，解读写入 0。列表 30，读正文 8，过期 0，硬件排除 0，预算未采 22，模型未返回（接口返回 400），未写入政策。";

test("信源回看的长句拆成标题、计数和失败原因", () => {
  const view = presentWorkMessage(xian);
  assert.equal(view.title, "西安·高新区门户");
  assert.deepEqual(view.chips, ["采集 8", "评了 0", "低分过滤 0", "解读写入 0", "列表 30", "读正文 8", "过期 0", "硬件排除 0", "预算未采 22"]);
  assert.deepEqual(view.notes, ["模型未返回（接口返回 400）", "未写入政策"]);
});

test("任务汇总按竖线拆开，短计数单独成条", () => {
  const view = presentWorkMessage(
    "立即执行「每日回看」｜回看 365 天｜访问 1 个信源｜采集 8，评了 0，低分过滤 0，解读写入 0。候选先入库。有模型时读正文判断是否与工作室有关，并写一段解读。",
  );
  assert.equal(view.title, "立即执行「每日回看」");
  assert.ok(view.chips.includes("回看 365 天"));
  assert.ok(view.chips.includes("采集 8"));
  assert.ok(view.chips.includes("解读写入 0"));
  assert.ok(view.notes.some((note) => note.includes("候选先入库")));
  assert.ok(view.notes.some((note) => note.includes("写一段解读")));
});

test("普通短记录保持原句", () => {
  const view = presentWorkMessage("Agent 读取赛道词典，共 10 条。");
  assert.equal(view.title, "Agent 读取赛道词典，共 10 条");
  assert.deepEqual(view.chips, []);
  assert.deepEqual(view.notes, []);
});

test("执行记录时间用北京时间", () => {
  assert.equal(formatWorkTime("2026-10-27T01:10:00.000Z"), "10月27日 09:10");
});

test("清空只删除执行记录，并返回条数", async () => {
  const queries: string[] = [];
  const cleared = await clearCrawlJobs({
    prepare(query) {
      queries.push(query);
      return {
        async first() {
          return { total: 3 };
        },
        async run() {
          return { success: true };
        },
      };
    },
  });
  assert.equal(cleared, 3);
  assert.equal(queries.some((query) => query.includes("DELETE FROM crawl_jobs")), true);
  assert.equal(queries.some((query) => /agent_tasks/i.test(query)), false);
});

test("没有记录时清空结果是 0", async () => {
  const cleared = await clearCrawlJobs({
    prepare() {
      return {
        async first() {
          return null;
        },
        async run() {
          return {};
        },
      };
    },
  });
  assert.equal(cleared, 0);
});
