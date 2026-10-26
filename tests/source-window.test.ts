import assert from "node:assert/strict";
import test from "node:test";
import { selectOpportunityItems } from "../lib/source-window.ts";

const now = new Date("2026-10-26T00:00:00Z");

test("约一年内且能映射赛道的条目留下", () => {
  const result = selectOpportunityItems(
    [
      {
        title: "关于征集人工智能应用服务商资源池的通知",
        url: "https://jxj.beijing.gov.cn/zwgk/2024zcwj/202609/t20260918_4869487.html",
      },
    ],
    365,
    now,
  );
  assert.equal(result.keep.length, 1);
  assert.equal(result.keep[0]?.track, "T10");
  assert.deepEqual(result.keep[0]?.tracks, ["T10"]);
  assert.match(result.keep[0]?.excerpt ?? "", /资源池/);
  assert.match(result.keep[0]?.opportunity ?? "", /资源池|入库/);
  assert.equal(result.droppedOld, 0);
});

test("过宽的园区或中小企业口径不入库", () => {
  const result = selectOpportunityItems(
    [
      { title: "关于组织开展绿色工业园区推荐工作的通知", url: "https://example.com/20261001/park.html" },
      { title: "关于组织开展创新型中小企业申报及复核工作的通知", url: "https://example.com/20261002/sme.html" },
      { title: "关于开展中小企业数字化改造项目申报的通知", url: "https://example.com/20261003/digital.html" },
    ],
    365,
    now,
  );
  assert.equal(result.keep.length, 1);
  assert.equal(result.keep[0]?.track, "T09");
  assert.equal(result.droppedBroad, 2);
});

test("超过回看窗口、硬件和未映射的条目不入库", () => {
  const result = selectOpportunityItems(
    [
      { title: "2023年人工智能服务商入库通知", url: "https://example.com/20230115/old.html" },
      { title: "机器人关节驱动方案征集", url: "https://example.com/20261001/robot.html" },
      { title: "关于召开工作会议的通知", url: "https://example.com/20261001/meeting.html" },
    ],
    365,
    now,
  );
  assert.equal(result.keep.length, 0);
  assert.equal(result.droppedOld, 1);
  assert.equal(result.droppedExcluded, 1);
  assert.equal(result.droppedUnmapped, 1);
});
