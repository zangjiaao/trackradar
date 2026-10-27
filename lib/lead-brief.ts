import type { LeadRow } from "@/lib/domain";

export type LeadBrief = {
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

/** 对话检索用的一条政策或案例。只来自清单，不含低分过滤的候选。 */
export function leadBrief(lead: LeadRow): LeadBrief {
  const kind = lead.kind === "case" ? "case" : "policy";
  const tracks = lead.track_codes.length ? lead.track_codes.join("、") : text(lead.track_code);
  const opportunity = text(lead.studio_angle) || text(lead.opportunity_note);
  return {
    kind,
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
    signal: kind === "case" ? text(lead.signal) : null,
    seen: kind === "case" ? text(lead.summary) || text(lead.relevant_excerpt) : null,
    fit: kind === "case" ? text(lead.opportunity_note) || text(lead.studio_angle) : null,
    value_score: score(lead.score_total),
  };
}

/** 系统提示里的一行，带上相关性分和解读，方便据此建议方向。 */
export function leadBriefLine(lead: LeadRow): string {
  const brief = leadBrief(lead);
  const parts = [
    brief.kind === "case" ? "案例" : "政策",
    brief.title,
    brief.tracks ? `赛道 ${brief.tracks}` : null,
    brief.region,
    brief.relevance_score != null ? `相关性 ${brief.relevance_score}` : null,
    brief.relevance_reason ? `评分理由 ${brief.relevance_reason}` : null,
    brief.opportunity ? `机会 ${brief.opportunity}` : null,
    brief.subsidy ? `福利 ${brief.subsidy}` : null,
    brief.participation ? `参与 ${brief.participation}` : null,
    brief.threshold ? `门槛 ${brief.threshold}` : null,
    brief.contact ? `联络人 ${brief.contact}` : null,
    brief.signal ? `信号 ${brief.signal}` : null,
    brief.seen ? `内容 ${brief.seen}` : null,
    brief.fit ? `关系 ${brief.fit}` : null,
    brief.value_score != null && brief.value_score > 0 ? `价值分 ${brief.value_score}` : null,
    brief.url,
  ];
  return `- ${parts.filter(Boolean).join("｜")}`;
}
