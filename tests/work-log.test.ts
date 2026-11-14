import assert from "node:assert/strict";
import test from "node:test";
import { clearCrawlJobs, formatWorkTime, presentWorkMessage, summarizeWorkMessage } from "../lib/work-log-view.ts";

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


test("执行摘要只突出关键计数，运行阶段保持可见，长说明留在详情", () => {
  const view = summarizeWorkMessage({ status: "running", message: "立即执行「OPC」｜访问 7 页｜正在筛选候选｜新增候选 195，评了 48，过滤 26，写入案例 22，待筛选 147。候选保留，下次继续。" });
  assert.deepEqual(view.metrics, ["新增候选 195", "评了 48", "过滤 26", "写入案例 22", "待筛选 147"]);
  assert.equal(view.notice, "正在筛选候选");
  assert.deepEqual(view.details, ["访问 7 页", "候选保留，下次继续"]);
});

test("失败原因和未完成原因留在摘要，重复的流程说明不淹没列表", () => {
  const failed = summarizeWorkMessage({ status: "failed", message: xian });
  assert.equal(failed.notice, "模型未返回（接口返回 400）");
  assert.deepEqual(failed.metrics, ["采集 8", "评了 0", "低分过滤 0", "解读写入 0"]);
  assert.ok(failed.details.includes("未写入政策"));
  const partial = summarizeWorkMessage({ status: "partial", message: "立即执行「OPC」｜访问 7 页｜新增候选 0，评了 67，过滤 40，写入案例 27，待筛选 80。仍有待筛选候选，可立即执行继续处理" });
  assert.match(partial.notice ?? "", /仍有待筛选候选/);
  const done = summarizeWorkMessage({ status: "done", message: "定时执行「政策」｜采集 8，评了 8，低分过滤 4，解读写入 4。候选先入库。有模型时读正文判断是否与工作室有关，并写一段解读。" });
  assert.equal(done.notice, null);
  assert.ok(done.details.includes("候选先入库"));
});

test("没有计数的短错误不重复展示，未知格式仍保留完整说明", () => {
  const short = summarizeWorkMessage({ status: "failed", message: "HTTP 520" });
  assert.equal(short.title, "HTTP 520");
  assert.equal(short.notice, null);
  const unknown = summarizeWorkMessage({ status: "done", message: "自定义任务｜返回 12 条。完整结果保留。" });
  assert.deepEqual(unknown.metrics, ["返回 12 条"]);
  assert.deepEqual(unknown.details, ["完整结果保留"]);
});


test("HTTP 状态和英文超时是可见失败原因，信源 URL 只进入详情", () => {
  const http = summarizeWorkMessage({ status: "failed", message: "深圳·市工信局：HTTP 520。列表 http://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg" });
  assert.equal(http.notice, "HTTP 520");
  assert.deepEqual(http.metrics, []);
  assert.deepEqual(http.details, ["列表 http://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg"]);
  const timeout = summarizeWorkMessage({ status: "failed", message: "杭州·市经信局：The operation was aborted due to timeout。列表 https://jxj.hangzhou.gov.cn/col/col1229252271/index.html" });
  assert.equal(timeout.notice, "The operation was aborted due to timeout");
  assert.equal(timeout.details.length, 1);
});
