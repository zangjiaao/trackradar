import assert from "node:assert/strict";
import test from "node:test";
import { inferLeadKind } from "../lib/lead-kind.ts";
import { opportunityHref } from "../lib/lead-presentation.ts";

test("信源和种子归政策，人工录入和市场站点归案例", () => {
  assert.equal(inferLeadKind("agent", null), "policy");
  assert.equal(inferLeadKind("crawl", null), "policy");
  assert.equal(inferLeadKind("seed", null), "policy");
  assert.equal(inferLeadKind("manual", "other"), "case");
  assert.equal(inferLeadKind("agent", "fiverr"), "case");
  assert.equal(inferLeadKind("agent", "zbj"), "case");
});

test("政策和案例各自保留筛选地址", () => {
  assert.equal(opportunityHref(null, "score_desc"), "/");
  assert.equal(opportunityHref("T09", "score_desc"), "/?track=T09");
  assert.equal(opportunityHref("T01", "time_desc", "/cases"), "/cases?track=T01&sort=time_desc");
  assert.equal(opportunityHref(null, "score_desc", "/cases"), "/cases");
});
