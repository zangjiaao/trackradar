import { MATERIAL_SITES, ORIGIN_LABEL, SIDE_LABEL, WEIGHTS, type Side } from "@/lib/domain";
import type { TrackDictionary } from "@/lib/guess";
import { readPolicy } from "@/lib/policy-read";
import { extractItemDate } from "@/lib/source-window";

export const LEAD_SORTS = ["score_desc", "score_asc", "time_desc", "time_asc"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export const LEAD_SORT_OPTIONS: { value: LeadSort; label: string; caption: string }[] = [
  { value: "score_desc", label: "价值分高→低", caption: "当前按价值分从高到低排列。" },
  { value: "score_asc", label: "价值分低→高", caption: "当前按价值分从低到高排列。" },
  { value: "time_desc", label: "时间新→旧", caption: "当前按时间从新到旧排列。有发布日用发布日，否则用发现时间。" },
  { value: "time_asc", label: "时间旧→新", caption: "当前按时间从旧到新排列。有发布日用发布日，否则用发现时间。" },
];

const FACTORS = [
  { key: "capability", label: "能力", weight: WEIGHTS.capability },
  { key: "funding_window", label: "资金", weight: WEIGHTS.funding_window },
  { key: "demand_density", label: "需求", weight: WEIGHTS.demand_density },
  { key: "policy_heat", label: "政策", weight: WEIGHTS.policy_heat },
  { key: "competition", label: "竞争", weight: WEIGHTS.competition },
  { key: "demo_feasibility", label: "demo", weight: WEIGHTS.demo_feasibility },
] as const;

export const VALUE_SCORE_FORMULA = `价值分 = ${FACTORS.map((item) => `${item.label}×${Math.round(item.weight * 100)}%`).join(" + ")}。各项按标题线索估 0–100 后加权，用来排序，不是调研结论。没有分的显示「未评分」。`;

export function parseLeadSort(value: unknown): LeadSort {
  return typeof value === "string" && (LEAD_SORTS as readonly string[]).includes(value) ? (value as LeadSort) : "score_desc";
}

export function opportunityHref(track: string | null, sort: LeadSort): string {
  const params = new URLSearchParams();
  if (track) params.set("track", track);
  if (sort !== "score_desc") params.set("sort", sort);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function calendarDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** 只有标题或链接里的完整日期才当作原文发布日。仅有年份时不编一个 12 月 31 日。 */
export function publishedDay(title: string, url: string): string | null {
  const found = extractItemDate(title, url);
  return found?.precision === "day" ? found.iso : null;
}

function shanghaiDay(value: string): string | null {
  const stored = calendarDay(value);
  if (stored && !value.includes("T")) return stored;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return stored;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(parsed));
  return calendarDay(parts);
}

export type LeadWhen = { kind: "发布" | "发现"; label: string; sortAt: string };

export function leadWhen(input: {
  title: string;
  url: string;
  published_at: string | null;
  created_at: string;
}): LeadWhen {
  const published = calendarDay(input.published_at) ?? publishedDay(input.title, input.url);
  if (published) return { kind: "发布", label: `发布 ${published}`, sortAt: `${published}T12:00:00+08:00` };
  const day = input.created_at ? shanghaiDay(input.created_at) : null;
  return { kind: "发现", label: day ? `发现 ${day}` : "发现时间未知", sortAt: input.created_at || "" };
}

export function formatValueScore(total: number | null | undefined): string {
  const value = typeof total === "number" ? total : Number(total);
  if (!Number.isFinite(value) || value <= 0) return "未评分";
  const rounded = Math.round(value * 10) / 10;
  return `价值分 ${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

function trimNum(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function scoreBreakdown(input: {
  score_capability: number | null;
  score_funding: number | null;
  score_demand: number | null;
  score_policy: number | null;
  score_competition: number | null;
  score_demo: number | null;
}): string | null {
  const values = [
    input.score_capability,
    input.score_funding,
    input.score_demand,
    input.score_policy,
    input.score_competition,
    input.score_demo,
  ];
  if (values.some((value) => value == null || !Number.isFinite(value))) return null;
  return FACTORS.map((item, index) => `${item.label} ${trimNum(values[index] ?? 0)}×${Math.round(item.weight * 100)}%`).join(" · ");
}

export function namedSide(side: string | null | undefined): string | null {
  if (!side || !(side in SIDE_LABEL)) return null;
  return SIDE_LABEL[side as Side];
}

export function namedSite(site: string | null | undefined): string | null {
  const text = site?.trim() ?? "";
  if (!text || text === "—" || text === "other") return null;
  return MATERIAL_SITES.find((item) => item.value === text)?.label ?? text;
}

export function namedOrigin(origin: string | null | undefined): string | null {
  const text = origin?.trim() ?? "";
  if (!text) return null;
  return ORIGIN_LABEL[text] ?? null;
}

function isPlaceholderSummary(summary: string): boolean {
  return /分数是价值分|分数是骨架分|信源回看约|列表页骨架|种子线索|启发式/.test(summary);
}

/** 库里已有解读就用库里的。早期只存了占位摘要时，按标题用同一套政策解读补上，不改分数。 */
export function presentReading(
  input: { title: string; summary: string | null; relevant_excerpt: string | null; opportunity_note: string | null },
  dictionaries?: TrackDictionary[],
): { summary: string | null; excerpt: string | null; opportunity: string | null } {
  const storedSummary = input.summary?.trim() ?? "";
  const storedExcerpt = input.relevant_excerpt?.trim() ?? "";
  const storedOpportunity = input.opportunity_note?.trim() ?? "";
  const reading = readPolicy(input.title, dictionaries);
  const summary = storedSummary && !isPlaceholderSummary(storedSummary) ? storedSummary : reading.keep ? reading.summary : storedSummary;
  const excerpt = storedExcerpt || (reading.keep ? reading.excerpt : "");
  const opportunity = storedOpportunity || (reading.keep ? reading.opportunity : "");
  return {
    summary: summary || null,
    excerpt: excerpt || null,
    opportunity: opportunity || null,
  };
}

export function shortExcerpt(text: string | null | undefined, max = 140): string | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export type SortableLead = {
  score_total: number | null;
  title: string;
  url: string;
  published_at: string | null;
  created_at: string;
};

function scoreRank(total: number | null, direction: "desc" | "asc"): number {
  if (total == null || !Number.isFinite(total) || total <= 0) {
    return direction === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return total;
}

export function sortLeads<T extends SortableLead>(leads: T[], sort: LeadSort): T[] {
  const direction = sort.endsWith("asc") ? "asc" : "desc";
  return leads
    .map((lead, index) => ({ lead, index }))
    .sort((a, b) => {
      if (sort.startsWith("score")) {
        const delta = scoreRank(a.lead.score_total, direction) - scoreRank(b.lead.score_total, direction);
        if (delta !== 0) return direction === "desc" ? -delta : delta;
      } else {
        const left = leadWhen(a.lead).sortAt;
        const right = leadWhen(b.lead).sortAt;
        if (left !== right) return direction === "desc" ? right.localeCompare(left) : left.localeCompare(right);
      }
      const newer = b.lead.created_at.localeCompare(a.lead.created_at);
      if (newer !== 0) return newer;
      return a.index - b.index;
    })
    .map((item) => item.lead);
}
