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
  assert.equal(result.droppedOld, 0);
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
