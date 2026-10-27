import assert from "node:assert/strict";
import test from "node:test";
import { composeListDate, extractItemDate, withinLookback } from "../lib/source-window.ts";

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

test("文章链接里的长数字不是日期，列表旁的日和年月可以合成发布日", () => {
  const snowflake = extractItemDate(
    "关于西安市中小企业数字化转型城市试点改造项目第二批通过验收企业的公示",
    "https://gxj.xa.gov.cn/gzdt/tzgg/2104492035763965953.html",
  );
  assert.equal(snowflake, null);
  assert.equal(composeListDate("28", "2026-09"), "2026-09-28");
  assert.equal(composeListDate("04", "2026-09"), "2026-09-04");
  assert.equal(composeListDate("32", "2026-09"), null);
  const pathDay = extractItemDate("通知", "https://example.com/20261001/a.html");
  assert.equal(pathDay?.iso, "2026-10-01");
  assert.equal(pathDay?.precision, "day");
});
