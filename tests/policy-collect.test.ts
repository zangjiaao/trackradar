import assert from "node:assert/strict";
import test from "node:test";
import {
  RELEVANCE_THRESHOLD,
  focusArticleText,
  formatScanSourceMessage,
  localRelevance,
  partitionListItems,
  type ScanTally,
} from "../lib/policy-collect.ts";

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

test("本地评分：词典或工作室词过线，过宽和无关低于阈值", () => {
  const mapped = localRelevance("关于开展中小企业数字化改造项目申报的通知");
  const studioOnly = localRelevance("关于召开工作会议的通知\n支持企业采购软件，用于内部流程。");
  const broad = localRelevance("关于组织开展绿色工业园区推荐工作的通知");
  const empty = localRelevance("关于召开工作会议的通知");
  assert.ok(mapped.score >= RELEVANCE_THRESHOLD);
  assert.ok(studioOnly.score >= RELEVANCE_THRESHOLD);
  assert.ok(broad.score < RELEVANCE_THRESHOLD);
  assert.ok(empty.score < RELEVANCE_THRESHOLD);
  assert.match(studioOnly.reason, /软件/);
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
  assert.match(message, /评分用 Agent/);
  assert.doesNotMatch(message, /未映射/);
});
