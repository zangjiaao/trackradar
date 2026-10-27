import { assessmentInputText } from "@/lib/article-attachments";
import type { PolicyAssessment } from "@/lib/policy-assess";
import { clampRelevance, type ScoreMode } from "@/lib/policy-collect";

/** 一次聊天补全只评这么多条，避免八篇正文加附件把网关撑超时。 */
const PAIR = 2;
/** 同时在飞的补全次数。两对并行，八条大约两轮。 */
const PARALLEL = 2;
/** 单次补全上限。高于原先整批 35 秒，但每批只有一两篇正文。 */
const CALL_TIMEOUT_MS = 36_000;
const MIN_CALL_MS = 8_000;
/** 从评估开始另计，不占用正文采集已经花掉的扫描预算。 */
const ASSESS_BUDGET_MS = 78_000;

export type ScoreInput = {
  url: string;
  title: string;
  body: string | null;
  region: string;
  sourceName: string;
};

export type AssessBatch = {
  mode: ScoreMode;
  byUrl: Map<string, PolicyAssessment>;
  note?: string;
};

type Complete = (batch: ScoreInput[], timeoutMs: number) => Promise<string>;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function readScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function unwrapFence(text: string): string {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() || trimmed;
}

function sliceBalanced(text: string, open: "{" | "["): string | null {
  const close = open === "{" ? "}" : "]";
  const start = text.indexOf(open);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index] ?? "";
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function repairTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function parseModelJson(text: string): unknown {
  const source = unwrapFence(text);
  const objectAt = source.indexOf("{");
  const arrayAt = source.indexOf("[");
  const preferArray = arrayAt >= 0 && (objectAt < 0 || arrayAt < objectAt);
  const sliced = preferArray ? sliceBalanced(source, "[") : sliceBalanced(source, "{");
  const candidates = [sliced, source.trim()].filter((item): item is string => Boolean(item));
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(repairTrailingCommas(candidate));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("json");
}

type ParsedItem = { url: string; assessment: PolicyAssessment };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseItems(payload: unknown): ParsedItem[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.items)
      ? record.items
      : record && ("score" in record || "reading" in record)
        ? [record]
        : [];
  const parsed: ParsedItem[] = [];
  for (const entry of list) {
    const item = asRecord(entry);
    if (!item) continue;
    const score = readScore(item.score);
    if (score === null) continue;
    parsed.push({
      url: clean(item.url, 500),
      assessment: {
        score: clampRelevance(score),
        reason: clean(item.reason, 180) || "模型给出了相关性判断。",
        reading: clean(item.reading, 500),
        subsidy: clean(item.subsidy, 500),
        participation: clean(item.participation, 500),
        threshold: clean(item.threshold, 500),
        contact: clean(item.contact, 500),
        window: clean(item.window, 200),
      },
    });
  }
  return parsed;
}

/** 从模型正文里取出评估。允许 ```json 围栏、尾逗号，以及条数一致时按顺序对齐 url。 */
export function assessmentsFromModelText(
  text: string,
  expectedUrls: string[],
): { byUrl: Map<string, PolicyAssessment>; reason?: string } {
  if (!text.trim()) return { byUrl: new Map(), reason: "返回为空" };
  let payload: unknown;
  try {
    payload = parseModelJson(text);
  } catch {
    return { byUrl: new Map(), reason: "返回不是合法 JSON" };
  }
  const parsed = parseItems(payload);
  if (parsed.length === 0) return { byUrl: new Map(), reason: "返回里没有条目" };

  const byUrl = new Map<string, PolicyAssessment>();
  const expected = expectedUrls.map((url) => url.trim()).filter(Boolean);
  const used = new Set<number>();
  for (const url of expected) {
    const index = parsed.findIndex((item, itemIndex) => !used.has(itemIndex) && item.url === url);
    if (index < 0) continue;
    used.add(index);
    const item = parsed[index];
    if (item) byUrl.set(url, item.assessment);
  }

  const unmatchedExpected = expected.filter((url) => !byUrl.has(url));
  const unmatchedParsed = parsed.filter((_, index) => !used.has(index));
  if (unmatchedExpected.length > 0 && unmatchedExpected.length === unmatchedParsed.length) {
    unmatchedExpected.forEach((url, index) => {
      const item = unmatchedParsed[index];
      if (item) byUrl.set(url, item.assessment);
    });
  }
  if (byUrl.size === 0) return { byUrl, reason: "返回里没有条目" };
  return { byUrl };
}

function statusOf(error: unknown, depth = 0): number | null {
  if (!error || typeof error !== "object" || depth > 3) return null;
  const record = error as { statusCode?: unknown; status?: unknown; cause?: unknown };
  const status = record.statusCode ?? record.status;
  if (typeof status === "number" && Number.isFinite(status)) return status;
  return statusOf(record.cause, depth + 1);
}

function errorBlob(error: unknown, depth = 0): string {
  if (!error || depth > 3) return "";
  if (typeof error === "string") return error.slice(0, 500);
  if (typeof error !== "object") return "";
  const record = error as { name?: unknown; message?: unknown; responseBody?: unknown; cause?: unknown };
  const name = error instanceof Error ? error.name : typeof record.name === "string" ? record.name : "";
  const message = error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "";
  const body = typeof record.responseBody === "string" ? record.responseBody.slice(0, 500) : "";
  return `${name} ${message} ${body} ${errorBlob(record.cause, depth + 1)}`.slice(0, 1500);
}

/** 评估失败时给执行记录的短原因。不回传响应正文，避免带上密钥。 */
export function assessErrorReason(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const blob = errorBlob(error).toLowerCase();
  if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out|aborted|abort/.test(blob)) return "评估超时";
  const status = statusOf(error);
  if (status === 408 || status === 504) return "评估超时";
  if (status === 400 && /json_schema|response_format|structured|invalid schema/.test(blob)) return "接口不接受结构化输出";
  if (status === 413 || /context length|maximum context|too many tokens|payload too large/.test(blob)) return "正文过长";
  if (status) return `接口返回 ${status}`;
  return "评估失败";
}

function isAuthStatus(error: unknown): boolean {
  const status = statusOf(error);
  return status === 401 || status === 403;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

function summarize(reasons: string[], missed: number, scored: number): string | undefined {
  const unique = [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))];
  const head = unique[0];
  if (!head || missed === 0) return undefined;
  if (scored === 0) return head.slice(0, 40);
  return `未评 ${missed}：${head}`.slice(0, 40);
}

/** 分小批调用聊天补全并解析 JSON。调用方传入 complete，测试不必打到网络。 */
export async function collectAssessments(input: {
  items: ScoreInput[];
  deadline?: number;
  now?: () => number;
  complete: Complete;
}): Promise<AssessBatch> {
  const byUrl = new Map<string, PolicyAssessment>();
  if (input.items.length === 0) return { mode: "fallback", byUrl };
  const clock = input.now ?? Date.now;
  const deadline = input.deadline ?? clock() + ASSESS_BUDGET_MS;
  const reasons: string[] = [];
  let stopped = false;

  async function call(batch: ScoreInput[]): Promise<"ok" | "split" | "stop"> {
    if (stopped || batch.length === 0) return "stop";
    const timeoutMs = Math.min(CALL_TIMEOUT_MS, deadline - clock());
    if (timeoutMs < MIN_CALL_MS) {
      reasons.push("评估时间不够");
      stopped = true;
      return "stop";
    }
    try {
      const text = await input.complete(batch, timeoutMs);
      const parsed = assessmentsFromModelText(text, batch.map((item) => item.url));
      for (const [url, value] of parsed.byUrl) byUrl.set(url, value);
      const missing = batch.filter((item) => !byUrl.has(item.url));
      if (missing.length === 0) return "ok";
      if (batch.length > 1) return "split";
      reasons.push(parsed.reason ?? "返回里没有条目");
      return "ok";
    } catch (error) {
      const reason = assessErrorReason(error);
      if (isAuthStatus(error)) {
        reasons.push(reason);
        stopped = true;
        return "stop";
      }
      if (batch.length > 1 && reason !== "评估超时" && !reason.startsWith("接口返回 429")) return "split";
      reasons.push(reason);
      return "ok";
    }
  }

  let pending = chunk(input.items, PAIR);
  while (pending.length > 0 && !stopped) {
    const wave = pending.splice(0, PARALLEL);
    const outcomes = await Promise.all(wave.map((batch) => call(batch)));
    const singles: ScoreInput[] = [];
    wave.forEach((batch, index) => {
      if (outcomes[index] !== "split") return;
      for (const item of batch) {
        if (!byUrl.has(item.url)) singles.push(item);
      }
    });
    for (const item of singles) {
      if (stopped || byUrl.has(item.url)) continue;
      await call([item]);
    }
  }

  const missed = input.items.filter((item) => !byUrl.has(item.url)).length;
  const note = summarize(reasons, missed, byUrl.size);
  if (byUrl.size === 0) return { mode: "fallback", byUrl, note: note ?? "返回里没有条目" };
  return { mode: "agent", byUrl, note };
}

/** 和对话一样只发普通文本，要求模型自己返回 JSON，不附带 json_schema。 */
export function assessmentPrompt(items: ScoreInput[]): string {
  const body = items
    .map((item, index) =>
      [`#${index + 1}`, `url: ${item.url}`, `出处: ${item.region} ${item.sourceName}`, `标题: ${item.title}`, `正文: ${assessmentInputText(item.body)}`].join("\n"),
    )
    .join("\n\n");
  return [
    body,
    "只返回一个 JSON 对象，不要 Markdown，不要解释。",
    '格式：{"items":[{"url":"原样复制","score":0到100的数字,"reason":"","reading":"","subsidy":"","participation":"","threshold":"","contact":"","window":""}]}',
    "items 必须覆盖上面每一条 url。无关则 score 低于 50 且 reading 为空字符串。",
  ].join("\n");
}
