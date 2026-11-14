import type { CaseAuthorFields, LeadRow } from "@/lib/domain";

export type LeadBrief = CaseAuthorFields & {
  kind: "policy" | "case";
  title: string;
  url: string;
  tracks: string | null;
  region: string | null;
  published_at: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  opportunity: string | null;
  subsidy: string | null;
  participation: string | null;
  threshold: string | null;
  contact: string | null;
  entries: string | null;
  signal: string | null;
  seen: string | null;
  fit: string | null;
  value_score: number | null;
};

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function score(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 办公室读取用的一条政策或案例。只来自清单，不含低分过滤的候选。 */
export function leadBrief(lead: LeadRow): LeadBrief {
  const kind = lead.kind === "case" ? "case" : "policy";
  const tracks = lead.track_codes.length ? lead.track_codes.join("、") : text(lead.track_code);
  const opportunity = text(lead.studio_angle) || text(lead.opportunity_note);
  const summary = text(lead.summary);
  return {
    kind,
    author: kind === "case" ? lead.author ?? null : null,
    related_cases: kind === "case" ? lead.related_cases ?? [] : [],
    related_cases_count: kind === "case" ? lead.related_cases_count ?? 0 : 0,
    title: lead.title,
    url: lead.url,
    tracks,
    region: text(lead.region),
    published_at: text(lead.published_at),
    relevance_score: score(lead.relevance_score),
    relevance_reason: text(lead.relevance_reason),
    opportunity: kind === "policy" ? opportunity : null,
    subsidy: kind === "policy" ? text(lead.subsidy_note) : null,
    participation: kind === "policy" ? text(lead.participation_note) : null,
    threshold: kind === "policy" ? text(lead.who_can_apply) : null,
    contact: kind === "policy" ? text(lead.contact_note) : null,
    entries: kind === "policy" && summary && summary !== opportunity ? summary : null,
    signal: kind === "case" ? text(lead.signal) : null,
    seen: kind === "case" ? text(lead.summary) || text(lead.relevant_excerpt) : null,
    fit: kind === "case" ? text(lead.opportunity_note) || text(lead.studio_angle) : null,
    value_score: score(lead.score_total),
  };
}
