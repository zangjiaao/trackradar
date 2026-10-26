import type { KeywordSetRow, LeadRow, ParsedSample, Platform, PromptRow, SampleRow, Side, SourceRow, TrackRow } from "./domain";
import { isPlatform, isSide } from "./domain";
import { getDb } from "./db";
import { fetchPolicyList } from "./fetch-list";
import { guessTrack, keywordList, type TrackDictionary } from "./guess";
import { readPolicy } from "./policy-read";
import { isTrackCode, sortTrackCodes, writeLeadTracks } from "./lead-tracks";
import { skeletonScores } from "./scoring";

export async function listTracks(): Promise<TrackRow[]> {
  const { results } = await getDb()
    .prepare("SELECT code, name, summary, studio_fit, keywords, sort_order FROM tracks ORDER BY sort_order")
    .all<TrackRow>();
  return results;
}

export async function loadTrackDictionaries(database: D1Database = getDb()): Promise<TrackDictionary[]> {
  const { results } = await database.prepare("SELECT code, keywords FROM tracks").all<{ code: string; keywords: string | null }>();
  return results.map((row) => ({ code: row.code, keywords: row.keywords ?? "" }));
}

export async function saveTrack(input: { code: string; name: string; summary: string; studio_fit: string; keywords: string }): Promise<void> {
  if (!isTrackCode(input.code)) throw new Error("赛道编号只能是 T01–T10。");
  const name = input.name.trim();
  const summary = input.summary.trim();
  const studioFit = input.studio_fit.trim();
  const keywords = keywordList(input.keywords).join("\n");
  if (name.length < 2 || name.length > 40) throw new Error("赛道名称需要 2–40 字。");
  if (summary.length < 4 || summary.length > 400) throw new Error("说明需要 4–400 字。");
  if (studioFit.length < 4 || studioFit.length > 400) throw new Error("工作室怎么接需要 4–400 字。");
  const existing = await getDb().prepare("SELECT code FROM tracks WHERE code = ?").bind(input.code).first<{ code: string }>();
  if (!existing) throw new Error("找不到该赛道。");
  await getDb()
    .prepare("UPDATE tracks SET name = ?, summary = ?, studio_fit = ?, keywords = ? WHERE code = ?")
    .bind(name, summary, studioFit, keywords, input.code)
    .run();
}

export async function listSources(): Promise<SourceRow[]> {
  const { results } = await getDb()
    .prepare("SELECT id, region, name, list_url, adapter, enabled, notes FROM sources ORDER BY region, name")
    .all<SourceRow>();
  return results;
}

type LeadQueryRow = Omit<LeadRow, "track_codes">;

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
  return rows.map((row) => ({
    ...row,
    track_codes: sortTrackCodes(grouped.get(row.id) ?? (row.track_code ? [row.track_code] : [])),
  }));
}

export async function listLeads(limit = 50, trackCode?: string | null): Promise<LeadRow[]> {
  const database = getDb();
  const track = trackCode && isTrackCode(trackCode) ? trackCode : null;
  const statement = track
    ? database
        .prepare(
          `SELECT id, source_id, track_code, title, url, summary, relevant_excerpt, opportunity_note, region, side, site, score_total, origin, created_at
           FROM leads
           WHERE id IN (SELECT lead_id FROM lead_tracks WHERE track_code = ?)
              OR track_code = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(track, track, limit)
    : database
        .prepare(
          `SELECT id, source_id, track_code, title, url, summary, relevant_excerpt, opportunity_note, region, side, site, score_total, origin, created_at
           FROM leads ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(limit);
  const { results } = await statement.all<LeadQueryRow>();
  return attachTrackCodes(database, results);
}

export async function listTrackEvents(): Promise<{ code: string; createdAt: string }[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT track_code AS code, created_at AS createdAt
       FROM (
         SELECT lt.track_code AS track_code, l.created_at AS created_at
         FROM lead_tracks lt
         JOIN leads l ON l.id = lt.lead_id
         UNION ALL
         SELECT l.track_code, l.created_at
         FROM leads l
         WHERE l.track_code IS NOT NULL
           AND l.id NOT IN (SELECT lead_id FROM lead_tracks)
       )`,
    )
    .all<{ code: string; createdAt: string }>();
  return results;
}

export async function listSamples(limit = 50): Promise<SampleRow[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, sampled_at, platform, keyword, title, url, side, price_or_signal, track_guess, note
       FROM manual_samples ORDER BY sampled_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<SampleRow>();
  return results;
}

export async function listKeywordSets(): Promise<KeywordSetRow[]> {
  const { results } = await getDb()
    .prepare("SELECT id, name, platform, keywords, track_code FROM keyword_sets ORDER BY platform, name")
    .all<KeywordSetRow>();
  return results;
}

export async function getActivePrompt(): Promise<PromptRow | null> {
  return getDb()
    .prepare(
      `SELECT id, version, name, system_prompt, weights_json, is_active, updated_at
       FROM prompt_profiles WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
    )
    .first<PromptRow>();
}

export async function saveActivePrompt(systemPrompt: string): Promise<void> {
  const text = systemPrompt.trim();
  if (text.length < 20) throw new Error("提示词过短。");
  if (text.length > 8000) throw new Error("提示词过长。");
  const now = new Date().toISOString();
  await getDb()
    .prepare("UPDATE prompt_profiles SET system_prompt = ?, updated_at = ? WHERE is_active = 1")
    .bind(text, now)
    .run();
}

export async function counts(): Promise<{ tracks: number; leads: number; samples: number; sources: number }> {
  const row = await getDb()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tracks) AS tracks,
         (SELECT COUNT(*) FROM leads) AS leads,
         (SELECT COUNT(*) FROM manual_samples) AS samples,
         (SELECT COUNT(*) FROM sources) AS sources`,
    )
    .first<{ tracks: number; leads: number; samples: number; sources: number }>();
  return row ?? { tracks: 0, leads: 0, samples: 0, sources: 0 };
}

export type SampleDraft = ParsedSample & {
  platform: Platform;
  keyword: string | null;
  side: Side;
  sampled_at: string;
};

export async function insertSamples(drafts: SampleDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  const database = getDb();
  const statement = database.prepare(
    `INSERT INTO manual_samples
      (id, sampled_at, platform, keyword, title, url, side, price_or_signal, track_guess, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await database.batch(
    drafts.map((draft) =>
      statement.bind(
        crypto.randomUUID(),
        draft.sampled_at,
        draft.platform,
        draft.keyword,
        draft.title,
        draft.url,
        draft.side,
        draft.price_or_signal,
        draft.track_guess,
        draft.note,
      ),
    ),
  );
  return drafts.length;
}

export function normalizeSampleDrafts(input: unknown): SampleDraft[] {
  if (!Array.isArray(input)) throw new Error("items 需要是数组。");
  const now = new Date().toISOString();
  const drafts: SampleDraft[] = [];
  for (const item of input.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const platform = typeof row.platform === "string" ? row.platform : "";
    const side = typeof row.side === "string" ? row.side : "demand";
    if (!title || !/^https?:\/\//i.test(url) || !isPlatform(platform) || !isSide(side)) continue;
    drafts.push({
      title: title.slice(0, 300),
      url: url.slice(0, 2000),
      platform,
      side,
      keyword: typeof row.keyword === "string" && row.keyword.trim() ? row.keyword.trim().slice(0, 80) : null,
      price_or_signal: typeof row.price_or_signal === "string" && row.price_or_signal.trim() ? row.price_or_signal.trim().slice(0, 80) : null,
      track_guess: typeof row.track_guess === "string" && /^T\d{2}$/.test(row.track_guess) ? row.track_guess : null,
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim().slice(0, 500) : null,
      sampled_at: now,
    });
  }
  if (drafts.length === 0) throw new Error("没有可保存的条目。请确认每条都有标题和 http(s) 链接。");
  return drafts;
}

export async function fetchSourcePreview(sourceId: string, save: boolean) {
  const source = await getDb()
    .prepare("SELECT id, region, name, list_url, adapter, enabled, notes FROM sources WHERE id = ?")
    .bind(sourceId)
    .first<SourceRow>();
  if (!source) throw new Error("找不到该信源。");
  const fetched = await fetchPolicyList(source.list_url);
  const dictionaries = await loadTrackDictionaries();
  const started = new Date().toISOString();
  let saved = 0;
  if (save && fetched.items.length > 0) {
    saved = await insertLeadsFromList(source, fetched.items);
  }
  await getDb()
    .prepare(
      `INSERT INTO crawl_jobs (id, source_id, kind, status, message, started_at, finished_at)
       VALUES (?, ?, 'manual_fetch', ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      source.id,
      fetched.error ? "failed" : "done",
      fetched.error ? fetched.error : `抽到 ${fetched.items.length} 条${save ? `，新写入线索 ${saved} 条` : "（仅预览）"}`,
      started,
      new Date().toISOString(),
    )
    .run();
  return {
    source,
    items: fetched.items.map((item) => ({ ...item, track_guess: guessTrack(item.title, dictionaries) })),
    error: fetched.error ?? null,
    saved,
  };
}

async function insertLeadsFromList(source: SourceRow, items: { title: string; url: string }[]): Promise<number> {
  const database = getDb();
  const dictionaries = await loadTrackDictionaries(database);
  let saved = 0;
  for (const item of items) {
    const existing = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(item.url).first<{ id: string }>();
    if (existing) continue;
    const reading = readPolicy(item.title, dictionaries);
    if (!reading.keep) continue;
    const tracks = reading.tracks;
    const scores = skeletonScores(item.title, tracks[0] ?? null);
    const id = crypto.randomUUID();
    await database
      .prepare(
        `INSERT INTO leads (
           id, source_id, track_code, title, url, summary, relevant_excerpt, opportunity_note, region, score_capability, score_funding,
           score_demand, score_policy, score_competition, score_demo, score_total, origin
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'crawl')`,
      )
      .bind(
        id,
        source.id,
        tracks[0] ?? null,
        item.title,
        item.url,
        reading.summary,
        reading.excerpt,
        reading.opportunity,
        source.region,
        scores.capability,
        scores.funding_window,
        scores.demand_density,
        scores.policy_heat,
        scores.competition,
        scores.demo_feasibility,
        scores.total,
      )
      .run();
    await writeLeadTracks(database, id, tracks);
    saved += 1;
  }
  return saved;
}

export async function searchSources(input: { region?: string; keyword?: string; fetch?: boolean }) {
  const sources = await listSources();
  const region = input.region?.trim();
  const keyword = input.keyword?.trim();
  const matched = sources.filter((source) => {
    if (region && !source.region.includes(region) && !source.name.includes(region)) return false;
    if (keyword && !`${source.name} ${source.notes ?? ""}`.includes(keyword)) return false;
    return true;
  });
  const previews = [];
  if (input.fetch) {
    for (const source of matched.filter((item) => item.enabled).slice(0, 2)) {
      const fetched = await fetchPolicyList(source.list_url);
      previews.push({
        source_id: source.id,
        name: source.name,
        list_url: source.list_url,
        error: fetched.error ?? null,
        items: fetched.items.slice(0, 8),
      });
    }
  }
  return {
    sources: matched.map((source) => ({
      id: source.id,
      region: source.region,
      name: source.name,
      list_url: source.list_url,
      notes: source.notes,
    })),
    previews,
  };
}
