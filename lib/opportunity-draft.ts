import { MATERIAL_SITES, SIDE_LABEL, WEIGHTS, type MaterialSite, type Side, isSide } from "@/lib/domain";
import { exclusionNote, guessTracks, type TrackDictionary } from "@/lib/guess";
import { sortTrackCodes } from "@/lib/lead-tracks";
import { readPolicy } from "@/lib/policy-read";
import { skeletonScores, type ScoreParts } from "@/lib/scoring";

export type OpportunityDraft = {
  track_code: string | null;
  track_codes: string[];
  side: Side;
  summary: string;
  region: string | null;
  scores: ScoreParts;
  rationale: string;
  relevant_excerpt: string;
  opportunity_note: string;
  mode: "heuristic";
};

const REGIONS = ["上海", "北京", "深圳", "杭州", "西安", "银川", "宁夏"];

export function siteLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return MATERIAL_SITES.find((site) => site.value === value)?.label ?? value;
}

export function isMaterialSite(value: string): value is MaterialSite {
  return MATERIAL_SITES.some((site) => site.value === value);
}

function guessSide(text: string): Side {
  if (/供给|出售|接单|报价|服务商|供应/.test(text)) return "supply";
  if (/笔记|视频|分享|种草|测评/.test(text)) return "content";
  return "demand";
}

function guessRegion(text: string, given: string): string | null {
  const explicit = given.trim();
  if (explicit) return explicit.slice(0, 40);
  return REGIONS.find((region) => text.includes(region)) ?? null;
}

/** 没有模型时的填表建议：赛道、供需侧、摘要和骨架分。 */
export function heuristicDraft(input: {
  title: string;
  notes?: string;
  site?: string;
  region?: string;
  dictionaries?: TrackDictionary[];
}): OpportunityDraft {
  const title = input.title.trim();
  const notes = input.notes?.trim() ?? "";
  const text = `${title}\n${notes}`;
  const excluded = exclusionNote(text);
  const tracks = excluded ? [] : guessTracks(text, input.dictionaries);
  const track = tracks[0] ?? null;
  const side = guessSide(text);
  const region = guessRegion(text, input.region ?? "");
  const scores = skeletonScores(title || notes, track);
  const site = input.site ? siteLabel(input.site) : "";
  const summary = excluded
    ? excluded
    : [site && `来自${site}`, notes || title].filter(Boolean).join("。").slice(0, 400);
  const reading = readPolicy(text, input.dictionaries);
  const rationale = excluded
    ? "本地规则判断这条落在排除方向，不映射赛道。分数只作排序起点。"
    : reading.keep
      ? `${reading.summary}${reading.opportunity}分数是骨架分，不是调研结论。`
      : reading.reason === "broad"
        ? "本地规则觉得这条口径偏宽，或和工作室能力关系不大。自动回看不会入库。若仍要留下，请自己写明机会。"
        : `本地规则建议赛道 ${tracks.length ? tracks.join("、") : "未映射"}、${SIDE_LABEL[side]}。分数是骨架分，不是调研结论。`;
  return {
    track_code: track,
    track_codes: tracks,
    side,
    summary,
    region,
    scores,
    rationale,
    relevant_excerpt: reading.keep ? reading.excerpt : "",
    opportunity_note: reading.keep ? reading.opportunity : "",
    mode: "heuristic",
  };
}

export function normalizeSide(value: unknown): Side {
  return typeof value === "string" && isSide(value) ? value : "demand";
}

export function normalizeSite(value: string | null | undefined): MaterialSite {
  const text = value?.trim() ?? "";
  if (!text) return "other";
  if (isMaterialSite(text)) return text;
  const match = MATERIAL_SITES.find((site) => text === site.label || text.includes(site.label));
  return match?.value ?? "other";
}

function clampScore(value: unknown, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, number));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 分项来自建议或骨架分，总分按默认权重重算。 */
export function applySuggestedScores(raw: Partial<ScoreParts> | null | undefined, fallback: ScoreParts): ScoreParts {
  const capability = clampScore(raw?.capability, fallback.capability);
  const funding_window = clampScore(raw?.funding_window, fallback.funding_window);
  const demand_density = clampScore(raw?.demand_density, fallback.demand_density);
  const policy_heat = clampScore(raw?.policy_heat, fallback.policy_heat);
  const competition = clampScore(raw?.competition, fallback.competition);
  const demo_feasibility = clampScore(raw?.demo_feasibility, fallback.demo_feasibility);
  const total =
    capability * WEIGHTS.capability +
    funding_window * WEIGHTS.funding_window +
    demand_density * WEIGHTS.demand_density +
    policy_heat * WEIGHTS.policy_heat +
    competition * WEIGHTS.competition +
    demo_feasibility * WEIGHTS.demo_feasibility;
  return {
    capability,
    funding_window,
    demand_density,
    policy_heat,
    competition,
    demo_feasibility,
    total: round1(total),
  };
}

const TRACK_CODE = /^T(0[1-9]|10)$/;

export type OpportunityFields = {
  title: string;
  url: string;
  site?: string;
  notes?: string;
  region?: string;
  track_code?: string | null;
  track_codes?: string[] | null;
  side?: string | null;
  summary?: string | null;
  relevant_excerpt?: string | null;
  opportunity_note?: string | null;
  scores?: Partial<ScoreParts> | null;
};

export type FinalOpportunity = {
  title: string;
  url: string;
  site: MaterialSite;
  region: string | null;
  track_code: string | null;
  track_codes: string[];
  side: Side;
  summary: string;
  relevant_excerpt: string;
  opportunity_note: string;
  scores: ScoreParts;
};

/** 把表单或对话工具的字段收成一条可入库的机会。未给的赛道、侧和分数用本地规则补。 */
export function finalizeOpportunity(input: OpportunityFields, dictionaries?: TrackDictionary[]): FinalOpportunity {
  const title = input.title.trim().slice(0, 300);
  const url = input.url.trim().slice(0, 2000);
  if (!title) throw new Error("请填写标题。");
  if (!/^https?:\/\//i.test(url)) throw new Error("链接需要以 http:// 或 https:// 开头。");
  const site = normalizeSite(input.site);
  const notes = input.notes?.trim().slice(0, 800) ?? "";
  const draft = heuristicDraft({ title, notes, site, region: input.region, dictionaries });
  const excluded = exclusionNote(`${title}\n${notes}`);
  let tracks: string[];
  if (excluded) tracks = [];
  else if (input.track_codes !== undefined) tracks = sortTrackCodes(input.track_codes ?? []);
  else if (input.track_code === undefined) tracks = draft.track_codes;
  else if (input.track_code && TRACK_CODE.test(input.track_code)) tracks = [input.track_code];
  else tracks = [];
  const side = input.side === undefined ? draft.side : normalizeSide(input.side);
  const summary = (input.summary?.trim() || draft.summary).slice(0, 800);
  const relevantExcerpt = (input.relevant_excerpt === undefined ? draft.relevant_excerpt : (input.relevant_excerpt ?? "")).trim().slice(0, 200);
  const opportunityNote = (input.opportunity_note === undefined ? draft.opportunity_note : (input.opportunity_note ?? "")).trim().slice(0, 400);
  const regionText = input.region === undefined ? (draft.region ?? "") : input.region.trim().slice(0, 40);
  return {
    title,
    url,
    site,
    region: regionText || null,
    track_code: tracks[0] ?? null,
    track_codes: tracks,
    relevant_excerpt: relevantExcerpt,
    opportunity_note: opportunityNote,
    side,
    summary,
    scores: input.scores ? applySuggestedScores(input.scores, draft.scores) : draft.scores,
  };
}
