import assert from "node:assert/strict";
import test from "node:test";
import { deferHardwareExclusion, guessTracks, textForTrackMatch } from "../lib/guess.ts";
import { trackHeat, trendLabel } from "../lib/track-heat.ts";

test("一条素材可以命中多个赛道", () => {
  assert.deepEqual(guessTracks("政务园区智能体入库"), ["T08", "T10", "T02"]);
});

test("排除方向不打赛道标签", () => {
  assert.deepEqual(guessTracks("机器人政务智能体"), []);
});

test("目录里点到机器人时，知识库和智能体仍可匹配赛道", () => {
  assert.equal(deferHardwareExclusion("机器人关节驱动方案"), false);
  const catalog = "具身智能（机器人）3项，智能网联新能源汽车1项。企业知识库 LiveKnowledge。领域智能体。";
  assert.equal(deferHardwareExclusion(catalog), true);
  assert.deepEqual(guessTracks(textForTrackMatch(catalog)), ["T01", "T02"]);
});

test("词典关键词覆盖内置词", () => {
  const codes = guessTracks("帮企业做知识中台", [{ code: "T01", keywords: "知识中台" }]);
  assert.deepEqual(codes, ["T01"]);
});

test("热度用近 7 日相对上一周的增减", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const heat = trackHeat(
    [
      { code: "T01", createdAt: new Date(now - day).toISOString() },
      { code: "T01", createdAt: new Date(now - 2 * day).toISOString() },
      { code: "T01", createdAt: new Date(now - 10 * day).toISOString() },
      { code: "T02", createdAt: new Date(now - 20 * day).toISOString() },
    ],
    now,
  );
  assert.equal(heat.T01?.total, 3);
  assert.equal(heat.T01?.recent, 2);
  assert.equal(heat.T01?.previous, 1);
  assert.equal(heat.T01?.delta, 1);
  assert.equal(trendLabel(1), "↑1");
  assert.equal(trendLabel(-2), "↓2");
  assert.equal(trendLabel(0), "—");
  assert.equal(heat.T02?.delta, 0);
});
