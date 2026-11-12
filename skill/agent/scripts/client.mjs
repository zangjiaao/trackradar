#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const headers = { "content-type": "application/json", ...accessHeaders(origin) };
const response = await fetch(new URL(path, origin), {
  method: "POST",
  redirect: "error",
  headers,
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(20000),
}).catch((error) => {
  const message = error instanceof Error ? error.message : "没连上";
  fail(message.includes("redirect") ? "赛道雷达跳到了登录页。把办公室现有的服务令牌加进赛道雷达的 Access 策略，动作选 Service Auth。" : message);
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

function accessHeaders(origin) {
  if (origin.startsWith("http://")) return {};
  const token = serviceToken();
  if (!token) fail("没有读到 Access 服务令牌。在办公室工作目录执行，令牌在上一级 .dev.vars 的 CF_ACCESS_CLIENT_ID 和 CF_ACCESS_CLIENT_SECRET。");
  return token;
}

function serviceToken() {
  const fromEnv = tokenPair(process.env.CF_ACCESS_CLIENT_ID, process.env.CF_ACCESS_CLIENT_SECRET);
  if (fromEnv) return fromEnv;
  let dir = process.cwd();
  for (let i = 0; i < 4; i += 1) {
    let text = "";
    try {
      text = readFileSync(resolve(dir, ".dev.vars"), "utf8");
    } catch {
      text = "";
    }
    if (text) {
      const vars = devVars(text);
      const pair = tokenPair(vars.CF_ACCESS_CLIENT_ID, vars.CF_ACCESS_CLIENT_SECRET);
      if (pair) return pair;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function tokenPair(id, secret) {
  const clientId = id?.trim() ?? "";
  const clientSecret = secret?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret };
}

function devVars(text) {
  const vars = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    vars[trimmed.slice(0, eq).trim()] = unquote(trimmed.slice(eq + 1));
  }
  return vars;
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
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
