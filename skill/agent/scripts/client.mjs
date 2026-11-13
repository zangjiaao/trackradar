#!/usr/bin/env node
import { lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
  headers: { "content-type": "application/json", authorization: `Bearer ${agentKey()}` },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(20000),
}).catch((error) => {
  const message = error instanceof Error ? error.message : "没连上";
  fail(message.includes("redirect") ? "赛道雷达跳到了登录页。安装页和读取接口需要在 Access 里放行，读取接口另要 Agent API Key。" : message);
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

function agentKey() {
  const file = join(homedir(), ".config", "trackradar", "agent.key");
  let info;
  try {
    info = lstatSync(file);
  } catch {
    fail("没有 Agent API Key。在赛道雷达配置页创建，写到 ~/.config/trackradar/agent.key，权限 600。不要把钥匙写进命令或对话。");
  }
  if (!info.isFile() || info.isSymbolicLink()) fail("钥匙文件必须是普通文件。");
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) fail("钥匙文件必须属于当前用户。");
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) fail("钥匙文件权限必须是 600。");
  const key = readFileSync(file, "utf8").trim();
  if (!/^trk_[A-Za-z0-9_-]{20,}$/.test(key)) fail("钥匙文件内容不对。");
  return key;
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
