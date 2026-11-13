import { attachCaseAuthors } from "./case-author";
import type { CaseAuthorFields, LeadRow } from "./domain";
import { leadBrief } from "./lead-brief";
import { sortTrackCodes } from "./lead-tracks";

export const RADAR_BRIEF_DEFAULT = 20;
export const RADAR_BRIEF_MAX = 50;
const BRIEF_TEXT = 800;
const LEAD_TEXT = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const LEAD_COLUMNS = `l.id, l.source_id, l.track_code, l.title, l.url, l.summary, l.relevant_excerpt, l.opportunity_note,
  l.studio_angle, l.subsidy_note, l.participation_note, l.who_can_apply, l.contact_note, l.window_note,
  l.region, l.side, l.site, l.signal, l.kind, l.published_at, l.score_capability, l.score_funding, l.score_demand, l.score_policy,
  l.score_competition, l.score_demo, l.score_total, l.origin, l.created_at, COALESCE(s.name, CASE WHEN l.site = 'opcquan' THEN 'OPC圈' END) AS source_name,
  COALESCE(pc.relevance_score, cc.relevance_score) AS relevance_score, COALESCE(pc.relevance_reason, cc.relevance_reason) AS relevance_reason`;

const LEAD_JOINS = `FROM leads l
  LEFT JOIN sources s ON s.id = l.source_id
  LEFT JOIN policy_candidates pc ON pc.id = (
    SELECT pc2.id FROM policy_candidates pc2
    WHERE pc2.lead_id = l.id AND pc2.stage = 'interpreted'
    ORDER BY pc2.updated_at DESC, pc2.id DESC
    LIMIT 1
  )
  LEFT JOIN case_candidates cc ON cc.lead_id = l.id AND cc.stage = 'interpreted'`;

export class RadarInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RadarInputError";
  }
}

export type RadarCursor = { created_at: string; id: string | null };

export type RadarCard = CaseAuthorFields & {
  id: string;
  created_at: string;
  source_name: string | null;
  kind: "policy" | "case";
  title: string;
  url: string;
  tracks: string | null;
  region: string | null;
  published_at: string | null;
  value_score: number | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  reading: string | null;
  opportunity: string | null;
  subsidy: string | null;
  participation: string | null;
  threshold: string | null;
  contact: string | null;
  window: string | null;
  entries: string | null;
  signal: string | null;
  seen: string | null;
  fit: string | null;
};

export type RadarBrief = {
  items: RadarCard[];
  cursor: RadarCursor | null;
  has_more: boolean;
};

type LeadQueryRow = Omit<LeadRow, "track_codes" | "author" | "related_cases" | "related_cases_count">;

/** 没有游标时给最新一页。带上上次游标后，只给更晚入库的线索。 */
export async function radarBrief(database: D1Database, input: unknown = {}): Promise<RadarBrief> {
  const fields = objectInput(input);
  const limit = readLimit(fields.limit);
  const since = readInstant(fields.since);
  const afterId = readOptionalId(fields.after_id);
  if (afterId && !since) throw new RadarInputError("续读时要同时带上游标时间和编号。");

  const rows = since ? await leadsAfter(database, since, afterId, limit + 1) : await latestLeads(database, limit);
  const page = since && rows.length > limit ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const cursor: RadarCursor | null = last
    ? { created_at: last.created_at, id: last.id }
    : since
      ? { created_at: since, id: afterId }
      : null;
  return {
    items: page.map((lead) => toCard(lead, BRIEF_TEXT)),
    cursor,
    has_more: Boolean(since) && rows.length > limit,
  };
}

/** 读一条已经入库的政策或案例。编号对不上时 lead 为 null。 */
export async function radarLead(database: D1Database, input: unknown): Promise<{ lead: RadarCard | null }> {
  const fields = objectInput(input);
  const id = readRequiredId(fields.id);
  const row = await database
    .prepare(`SELECT ${LEAD_COLUMNS} ${LEAD_JOINS} WHERE l.id = ?`)
    .bind(id)
    .first<LeadQueryRow>();
  if (!row) return { lead: null };
  const [lead] = await attachTrackCodes(database, [row]);
  return { lead: toCard(lead, LEAD_TEXT) };
}

async function latestLeads(database: D1Database, limit: number): Promise<LeadRow[]> {
  const { results } = await database
    .prepare(
      `SELECT ${LEAD_COLUMNS} ${LEAD_JOINS}
       WHERE l.id IN (SELECT id FROM leads ORDER BY created_at DESC, id DESC LIMIT ?)
       ORDER BY l.created_at ASC, l.id ASC`,
    )
    .bind(limit)
    .all<LeadQueryRow>();
  return attachTrackCodes(database, results);
}

async function leadsAfter(database: D1Database, since: string, afterId: string | null, limit: number): Promise<LeadRow[]> {
  const where = afterId
    ? "l.created_at > ? OR (l.created_at = ? AND l.id > ?)"
    : "l.created_at > ?";
  const binds = afterId ? [since, since, afterId, limit] : [since, limit];
  const { results } = await database
    .prepare(`SELECT ${LEAD_COLUMNS} ${LEAD_JOINS} WHERE ${where} ORDER BY l.created_at ASC, l.id ASC LIMIT ?`)
    .bind(...binds)
    .all<LeadQueryRow>();
  return attachTrackCodes(database, results);
}

async function attachTrackCodes(database: D1Database, rows: LeadQueryRow[]): Promise<LeadRow[]> {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => "?").join(", ");
  const { results } = await database
    .prepare(`SELECT lead_id, track_code FROM lead_tracks WHERE lead_id IN (${placeholders})`)
    .bind(...rows.map((row) => row.id))
    .all<{ lead_id: string; track_code: string }>();
  const grouped = new Map<string, string[]>();
  for (const row of results) {
    const list = grouped.get(row.lead_id) ?? [];
    list.push(row.track_code);
    grouped.set(row.lead_id, list);
  }
  return attachCaseAuthors(database, rows.map((row) => ({
    ...row,
    track_codes: sortTrackCodes(grouped.get(row.id) ?? (row.track_code ? [row.track_code] : [])),
  })));
}

function toCard(lead: LeadRow, max: number): RadarCard {
  const brief = leadBrief(lead);
  const text = (value: string | null) => clip(value, max);
  const reading = brief.kind === "case" ? brief.fit || brief.seen : brief.opportunity || brief.entries;
  return {
    id: lead.id,
    created_at: lead.created_at,
    source_name: text(lead.source_name),
    kind: brief.kind,
    title: lead.title,
    url: lead.url,
    tracks: brief.tracks,
    region: brief.region,
    published_at: brief.published_at,
    value_score: brief.value_score,
    relevance_score: brief.relevance_score,
    relevance_reason: text(brief.relevance_reason),
    reading: text(reading),
    opportunity: text(brief.opportunity),
    subsidy: text(brief.subsidy),
    participation: text(brief.participation),
    threshold: text(brief.threshold),
    contact: text(brief.contact),
    window: brief.kind === "policy" ? text(lead.window_note) : null,
    entries: text(brief.entries),
    signal: text(brief.signal),
    seen: text(brief.seen),
    fit: text(brief.fit),
    author: brief.author,
    related_cases: brief.related_cases,
    related_cases_count: brief.related_cases_count,
  };
}

function objectInput(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) throw new RadarInputError("参数需要对象。");
  return input as Record<string, unknown>;
}

function readLimit(value: unknown): number {
  if (value === undefined) return RADAR_BRIEF_DEFAULT;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > RADAR_BRIEF_MAX) {
    throw new RadarInputError(`条数用 1 到 ${RADAR_BRIEF_MAX} 的整数。`);
  }
  return value;
}

function readInstant(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !INSTANT.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RadarInputError("游标时间写成 2026-11-12T02:00:00.000Z。");
  }
  return value;
}

function readOptionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return normalizeId(value);
}

function readRequiredId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new RadarInputError("要提供线索编号。");
  return normalizeId(value);
}

function normalizeId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new RadarInputError("线索编号无效。");
  return value.toLowerCase();
}

function clip(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const chars = [...trimmed];
  if (chars.length <= max) return trimmed;
  return `${chars.slice(0, max).join("")}…`;
}
