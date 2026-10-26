import assert from "node:assert/strict";
import test from "node:test";
import { DAILY_CRON, WEEKLY_CRON, decideCron } from "../lib/collect.ts";

test("每天周期只跑政策巡检那条 Cron", () => {
  const collect = { enabled: true, cadence: "daily" as const };
  assert.equal(decideCron(DAILY_CRON, collect), "run");
  assert.equal(decideCron(WEEKLY_CRON, collect), "skip");
});

test("每周周期只跑周一那条 Cron", () => {
  const collect = { enabled: true, cadence: "weekly" as const };
  assert.equal(decideCron(WEEKLY_CRON, collect), "run");
  assert.equal(decideCron(DAILY_CRON, collect), "skip");
});

test("关闭采集时两条都跳过", () => {
  const collect = { enabled: false, cadence: "daily" as const };
  assert.equal(decideCron(DAILY_CRON, collect), "skip");
  assert.equal(decideCron(WEEKLY_CRON, collect), "skip");
});
