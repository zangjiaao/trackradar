import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { radarPost } from "../lib/radar-http.ts";

const root = new URL("../skill/", import.meta.url);

test("安装说明告诉 Agent 装到技能目录，并且不要要授权链接", () => {
  const bootstrap = readFileSync(new URL("skill.md", root), "utf8");
  const installed = readFileSync(new URL("agent/SKILL.md", root), "utf8");
  const client = readFileSync(new URL("agent/scripts/client.mjs", root), "utf8");
  assert.match(bootstrap, /~\/\.agents\/skills\/trackradar/);
  assert.match(bootstrap, /不要执行 connect/);
  assert.match(installed, /name: trackradar/);
  assert.match(installed, /10:30/);
  assert.match(client, /\/api\/radar\/brief/);
  assert.match(client, /\/api\/radar\/lead/);
  assert.match(client, /redirect: "error"/);
  assert.match(client, /CF-Access-Client-Id/);
  assert.match(client, /CF-Access-Client-Secret/);
  assert.match(bootstrap, /Service Auth/);
  assert.match(installed, /不要把这两个值写进命令/);
});

test("读取接口拒绝坏参数，不查询数据库", async () => {
  const database = { prepare() { throw new Error("不应查询"); } } as unknown as D1Database;
  const response = await radarPost(
    database,
    "brief",
    new Request("https://trackradar.oak-studio.org/api/radar/brief", {
      method: "POST",
      body: JSON.stringify({ limit: 0 }),
    }),
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: string };
  assert.match(body.error ?? "", /条数/);
});
