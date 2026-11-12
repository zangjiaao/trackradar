#!/usr/bin/env node
const command = process.argv[2];
const flags = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  const value = process.argv[i + 1];
  if (!name?.startsWith("--") || !value) {
    fail("参数格式为 --名称 值");
  }
  flags[name.slice(2)] = value;
}

const origin = siteOrigin(flags.origin);
const path = command === "brief" ? "/api/radar/brief" : command === "lead" ? "/api/radar/lead" : "";
if (!path) fail("命令是 brief 或 lead");

const body = command === "brief" ? briefBody(flags) : { id: flags.id };
const response = await fetch(new URL(path, origin), {
  method: "POST",
  redirect: "error",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(20000),
}).catch((error) => {
  const message = error instanceof Error ? error.message : "没连上";
  fail(message.includes("redirect") ? "赛道雷达跳到了登录页，办公室读不到。Access 需要放行 /skill.md、/agent 和 /api/radar。" : message);
});

const text = await response.text();
if (!response.ok) fail(text || `读取失败：${response.status}`);
process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);

function briefBody(input) {
  const body = {};
  if (input.since) body.since = input.since;
  if (input["after-id"]) body.after_id = input["after-id"];
  if (input.limit) {
    if (!/^[1-9]\d*$/.test(input.limit)) fail("条数用整数");
    body.limit = Number(input.limit);
  }
  return body;
}

function siteOrigin(value) {
  let url;
  try {
    url = new URL(value || "");
  } catch {
    fail("站点来源无效");
  }
  const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port;
  const live = url.protocol === "https:" && url.hostname === "trackradar.oak-studio.org" && (!url.port || url.port === "443");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (!local && !live)) {
    fail("只连接 https://trackradar.oak-studio.org 或本机测试地址");
  }
  return url.origin;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
