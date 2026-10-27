import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractListItems, nextListPage } from "../lib/extract-links.ts";
import { pageExtendsLookback, walkListPages } from "../lib/list-pages.ts";
import { partitionListItems, selectCollectBatch } from "../lib/policy-collect.ts";

const base = "https://gxj.xa.gov.cn/gzdt/tzgg/1.html";
const now = new Date("2026-10-27T00:00:00Z");

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

test("西安列表从 date/year 取出发布日，雪花 ID 不改写日期", () => {
  const items = extractListItems(fixture("xa-tzgg-page1.html"), base);
  const acceptance = items.find((item) => item.url.endsWith("/2104492035763965953.html"));
  assert.ok(acceptance);
  assert.equal(acceptance?.publishedAt, "2026-09-28");
  assert.match(acceptance?.title ?? "", /通过验收/);
  assert.equal(nextListPage(fixture("xa-tzgg-page1.html"), base), "https://gxj.xa.gov.cn/gzdt/tzgg/2.html");
  const ranked = partitionListItems(items, 365, now);
  assert.equal(ranked.eligible.find((item) => item.url.endsWith("/2104492035763965953.html"))?.publishedAt, "2026-09-28");
  assert.notEqual(ranked.eligible[0]?.url, acceptance?.url);
});

test("翻到第2页后，验收公示、第四批和入库备案不会被预算或假日期丢掉", async () => {
  const pages = new Map([
    [base, fixture("xa-tzgg-page1.html")],
    ["https://gxj.xa.gov.cn/gzdt/tzgg/2.html", fixture("xa-tzgg-page2.html")],
    ["https://gxj.xa.gov.cn/gzdt/tzgg/3.html", fixture("xa-tzgg-page3.html")],
  ]);
  const requested: string[] = [];
  const walked = await walkListPages(
    base,
    async (url) => {
      requested.push(url);
      const html = pages.get(url);
      if (!html) return { error: "missing" };
      return { html, finalUrl: url };
    },
    { lookbackDays: 365, now, maxPages: 8 },
  );
  assert.deepEqual(requested, [base, "https://gxj.xa.gov.cn/gzdt/tzgg/2.html", "https://gxj.xa.gov.cn/gzdt/tzgg/3.html"]);
  assert.equal(pageExtendsLookback(extractListItems(fixture("xa-tzgg-page3.html"), base), 365, now), false);
  const ranked = partitionListItems(walked.items, 365, now);
  assert.equal(ranked.droppedOld, 1);
  const selected = selectCollectBatch(ranked.eligible, 4);
  const titles = selected.map((item) => item.title);
  assert.equal(titles.some((title) => title.includes("通过验收")), true);
  assert.equal(titles.some((title) => title.includes("第四批")), true);
  assert.equal(titles.some((title) => title.includes("补充入库备案")), true);
  assert.equal(titles.some((title) => title.includes("第五批")), true);
  assert.equal(titles.some((title) => title.includes("体检")), false);
  assert.equal(titles.some((title) => title.includes("专线")), false);
  assert.equal(titles.some((title) => title.includes("招租")), false);
});
