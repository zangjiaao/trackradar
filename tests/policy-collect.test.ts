import assert from "node:assert/strict";
import test from "node:test";
import { focusArticleText, formatScanSourceMessage, partitionListItems, type ScanTally } from "../lib/policy-collect.ts";

const now = new Date("2026-10-26T00:00:00Z");

test("赛道未映射或过宽的标题仍采集，过期和硬件不采集", () => {
  const result = partitionListItems(
    [
      { title: "关于征集人工智能应用服务商资源池的通知", url: "https://jxj.beijing.gov.cn/zwgk/2024zcwj/202609/t20260918_4869487.html" },
      { title: "关于组织开展绿色工业园区推荐工作的通知", url: "https://example.com/20261001/park.html" },
      { title: "关于召开工作会议的通知", url: "https://example.com/20261002/meeting.html" },
      { title: "2023年人工智能服务商入库通知", url: "https://example.com/20230115/old.html" },
      { title: "机器人关节驱动方案征集", url: "https://example.com/20261001/robot.html" },
    ],
    365,
    now,
  );
  assert.deepEqual(
    result.eligible.map((item) => item.title),
    [
      "关于召开工作会议的通知",
      "关于组织开展绿色工业园区推荐工作的通知",
      "关于征集人工智能应用服务商资源池的通知",
    ],
  );
  assert.equal(result.droppedOld, 1);
  assert.equal(result.droppedHardware, 1);
});

test("较新的条目优先采集", () => {
  const result = partitionListItems(
    [
      { title: "较早的软件项目", url: "https://example.com/20260101/a.html" },
      { title: "较新的软件项目", url: "https://example.com/20261020/b.html" },
      { title: "没有日期的软件项目", url: "https://example.com/notice.html" },
    ],
    365,
    now,
  );
  assert.equal(result.eligible[0]?.title, "较新的软件项目");
  assert.equal(result.eligible.at(-1)?.title, "没有日期的软件项目");
  assert.equal(result.eligible[0]?.publishedAt, "2026-10-20");
});

test("正文从标题最后一次出现处截起", () => {
  const text = "政务公开 政务大厅 关于征集软件项目的通知 首页 关于征集软件项目的通知 支持企业采购软件。";
  const focused = focusArticleText("关于征集软件项目的通知", text);
  assert.match(focused, /^关于征集软件项目的通知 支持企业采购软件/);
  assert.doesNotMatch(focused, /政务大厅/);
});

test("执行记录写出四步计数，不再写未映射", () => {
  const tally: ScanTally = {
    collected: 4,
    scored: 4,
    filtered: 3,
    interpreted: 1,
    listCount: 30,
    bodyReads: 4,
    droppedOld: 2,
    droppedHardware: 0,
    budgetSkipped: 24,
    duplicate: 0,
    scorer: "agent",
  };
  const message = formatScanSourceMessage("银川", "工信局", tally);
  assert.match(message, /采集 4，评了 4，低分过滤 3，解读写入 1/);
  assert.match(message, /列表 30，读正文 4，过期 2，硬件排除 0，预算未采 24/);
  assert.match(message, /解读用 Agent/);
  assert.doesNotMatch(message, /未映射/);
  const skipped = formatScanSourceMessage("银川", "门户", { ...tally, scored: 0, filtered: 0, interpreted: 0, scorer: "local" });
  assert.match(skipped, /未配置模型，未写入政策/);
  assert.doesNotMatch(skipped, /按本地规则评分/);
  const silent = formatScanSourceMessage("西安", "高新区门户", {
    ...tally,
    collected: 8,
    scored: 0,
    filtered: 0,
    interpreted: 0,
    listCount: 30,
    bodyReads: 8,
    droppedOld: 0,
    droppedHardware: 0,
    budgetSkipped: 22,
    scorer: "fallback",
  });
  assert.match(silent, /模型未返回，未写入政策/);
  const failed = formatScanSourceMessage("西安", "高新区门户", { ...silentInput(tally), scorerNote: "接口返回 400" });
  assert.match(failed, /采集 8，评了 0，低分过滤 0，解读写入 0/);
  assert.match(failed, /模型未返回（接口返回 400），未写入政策/);
  const leaked = formatScanSourceMessage("西安", "高新区门户", { ...silentInput(tally), scorerNote: "sk-live-secret 接口返回 401" });
  assert.match(leaked, /模型未返回，未写入政策/);
  assert.doesNotMatch(leaked, /sk-/);
  const partial = formatScanSourceMessage("西安", "高新区门户", {
    ...tally,
    collected: 8,
    scored: 6,
    filtered: 2,
    interpreted: 4,
    scorer: "agent",
    scorerNote: "未评 2：评估超时",
  });
  assert.match(partial, /解读用 Agent（未评 2：评估超时）/);
});

function silentInput(tally: ScanTally): ScanTally {
  return {
    ...tally,
    collected: 8,
    scored: 0,
    filtered: 0,
    interpreted: 0,
    listCount: 30,
    bodyReads: 8,
    droppedOld: 0,
    droppedHardware: 0,
    budgetSkipped: 22,
    scorer: "fallback",
  };
}
