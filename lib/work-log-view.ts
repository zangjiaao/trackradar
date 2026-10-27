export type WorkLogItem = {
  id: string;
  kind: string;
  status: string;
  message: string | null;
  created_at: string;
  source_name: string | null;
  source_region: string | null;
  task_name: string | null;
};

export type WorkLogView = {
  title: string;
  chips: string[];
  notes: string[];
};

export const WORK_KIND_LABEL: Record<string, string> = {
  policy_scan: "政策巡检",
  weekly_report: "周报",
  manual_fetch: "信源试抓",
  tool_list_tracks: "查看赛道",
  tool_list_leads: "查看机会",
  tool_search_sources: "查询信源",
  tool_suggest_opportunity: "补全素材",
  manual_entry: "录入案例",
  tool_add_opportunity: "对话写入案例",
  source_scan: "信源回看",
  task_run: "执行任务",
};

export const WORK_STATUS_LABEL: Record<string, string> = {
  placeholder: "占位",
  skipped: "跳过",
  done: "完成",
  failed: "失败",
};

type Statement = {
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type JobsDb = {
  prepare(query: string): Statement;
};

function isCount(part: string): boolean {
  return part.length > 0 && part.length <= 18 && !/https?:/i.test(part) && !part.includes("（") && !part.includes("(") && /\d/.test(part);
}

function takePieces(text: string): { chips: string[]; notes: string[] } {
  const chips: string[] = [];
  const notes: string[] = [];
  for (const sentence of text.split(/[。；]/)) {
    const clause = sentence.trim();
    if (!clause) continue;
    const parts = clause.split("，").map((part) => part.trim()).filter(Boolean);
    const counts = parts.filter(isCount);
    if (parts.length === 1 && isCount(clause)) chips.push(clause);
    else if (parts.length >= 2 && counts.length >= 2) {
      for (const part of parts) {
        if (isCount(part)) chips.push(part);
        else notes.push(part);
      }
    } else notes.push(clause);
  }
  return { chips, notes };
}

/** 把执行记录里的长句拆成标题、短计数和其余说明。 */
export function presentWorkMessage(message: string | null | undefined): WorkLogView {
  const text = message?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return { title: "没有说明", chips: [], notes: [] };

  if (text.includes("｜")) {
    const parts = text.split("｜").map((part) => part.trim()).filter(Boolean);
    const title = parts[0] ?? "执行记录";
    const body = takePieces(parts.slice(1).join("。"));
    return { title, chips: body.chips, notes: body.notes };
  }

  const colon = text.match(/^([^：]{1,48})：([\s\S]+)$/);
  if (colon?.[1] && colon[2]) {
    const body = takePieces(colon[2]);
    return { title: colon[1].trim(), chips: body.chips, notes: body.notes };
  }

  const body = takePieces(text);
  if (body.chips.length === 0 && body.notes.length === 1) return { title: body.notes[0] ?? text, chips: [], notes: [] };
  if (body.notes.length > 0 && body.chips.length > 0) {
    return { title: body.notes[0] ?? "执行记录", chips: body.chips, notes: body.notes.slice(1) };
  }
  return { title: text.length > 42 ? `${text.slice(0, 42)}…` : text, chips: body.chips, notes: body.notes };
}

/** 执行记录时间按北京时间显示。 */
export function formatWorkTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace("T", " ");
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = read("hour").padStart(2, "0");
  const minute = read("minute").padStart(2, "0");
  return `${read("month")}月${read("day")}日 ${hour}:${minute}`;
}

/** 只删除执行记录。定时任务在另一张表里，这里不会动。 */
export async function clearCrawlJobs(database: JobsDb): Promise<number> {
  const row = await database.prepare("SELECT COUNT(*) AS total FROM crawl_jobs").first<{ total: number }>();
  await database.prepare("DELETE FROM crawl_jobs").run();
  return Number(row?.total ?? 0);
}
