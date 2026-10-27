import assert from "node:assert/strict";
import test from "node:test";
import { extractItemDate, withinLookback } from "../lib/source-window.ts";

const now = new Date("2026-10-26T00:00:00Z");

test("完整日期按回看天数判断，只有年份时保留今年和去年", () => {
  const day = extractItemDate("通知", "https://example.com/20261001/a.html");
  const old = extractItemDate("通知", "https://example.com/20230115/old.html");
  const year = extractItemDate("2026年人工智能服务商入库通知", "https://example.com/notice.html");
  assert.equal(day?.precision, "day");
  assert.equal(withinLookback(day, 365, now), true);
  assert.equal(withinLookback(old, 365, now), false);
  assert.equal(year?.precision, "year");
  assert.equal(withinLookback(year, 365, now), true);
  assert.equal(withinLookback(null, 365, now), true);
});
