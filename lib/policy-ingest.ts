import { fetchPolicyArticle } from "@/lib/fetch-article";
import type { TrackDictionary } from "@/lib/guess";
import { writeLeadTracks } from "@/lib/lead-tracks";
import { publishedDay } from "@/lib/lead-presentation";
import { fallbackStudioAngle, extractNoticeFacts } from "@/lib/notice-facts";
import {
  COLLECT_PER_SOURCE,
  RELEVANCE_THRESHOLD,
  clampRelevance,
  focusArticleText,
  localRelevance,
  partitionListItems,
  type EligibleNotice,
  type ListNotice,
  type ScanTally,
  type ScoreMode,
} from "@/lib/policy-collect";
import { readPolicy } from "@/lib/policy-read";
import { scoreCandidatesWithAgent, type ScoreBatch, type ScoreInput } from "@/lib/policy-score";
import { skeletonScores } from "@/lib/scoring";

const BODY_RESERVE_MS = 8_000;
const BODY_STORE_LIMIT = 6_000;

type SourceRef = { id: string; region: string; name: string };

type StoredCandidate = EligibleNotice & { id: string; body: string | null };

export async function ingestPolicyList(input: {
  database: D1Database;
  source: SourceRef;
  items: ListNotice[];
  lookbackDays: number;
  now?: Date;
  dictionaries?: TrackDictionary[];
  deadline?: number;
  limit?: number;
  origin?: "agent" | "crawl";
  fetchArticle?: typeof fetchPolicyArticle;
  scoreBatch?: (items: ScoreInput[]) => Promise<ScoreBatch>;
}): Promise<ScanTally> {
  const now = input.now ?? new Date();
  const dictionaries = input.dictionaries;
  const deadline = input.deadline ?? Number.POSITIVE_INFINITY;
  const limit = input.limit ?? COLLECT_PER_SOURCE;
  const origin = input.origin ?? "agent";
  const fetchArticle = input.fetchArticle ?? fetchPolicyArticle;
  const scoreBatch = input.scoreBatch ?? scoreCandidatesWithAgent;
  const partitioned = partitionListItems(input.items, input.lookbackDays, now);
  const tally: ScanTally = {
    collected: 0,
    scored: 0,
    filtered: 0,
    interpreted: 0,
    listCount: input.items.length,
    bodyReads: 0,
    droppedOld: partitioned.droppedOld,
    droppedHardware: partitioned.droppedHardware,
    budgetSkipped: 0,
    duplicate: 0,
    scorer: "local",
  };

  const fresh: EligibleNotice[] = [];
  for (const item of partitioned.eligible) {
    if (await alreadySettled(input.database, item.url)) {
      tally.duplicate += 1;
      continue;
    }
    fresh.push(item);
  }
  const selected = fresh.slice(0, limit);
  tally.budgetSkipped = fresh.length - selected.length;

  const stored: StoredCandidate[] = [];
  for (const item of selected) {
    let body: string | null = null;
    let publishedAt = item.publishedAt;
    if (Date.now() < deadline - BODY_RESERVE_MS) {
      tally.bodyReads += 1;
      const article = await fetchArticle(item.url);
      if (article) {
        body = focusArticleText(item.title, article.text).slice(0, BODY_STORE_LIMIT);
        if (article.publishedAt) publishedAt = article.publishedAt;
      }
    }
    const id = await upsertRaw(input.database, input.source, { ...item, publishedAt }, body);
    stored.push({ ...item, publishedAt, body, id });
    tally.collected += 1;
  }

  if (stored.length === 0) return tally;
  const batch = await scoreBatch(
    stored.map((item) => ({
      url: item.url,
      title: item.title,
      body: item.body,
      region: input.source.region,
      sourceName: input.source.name,
    })),
  );
  tally.scorer = resolveMode(batch);

  for (const item of stored) {
    const text = item.body ? `${item.title}\n${item.body}` : item.title;
    const local = localRelevance(text, dictionaries);
    const agent = batch.mode === "agent" ? batch.byUrl.get(item.url) : undefined;
    const score = clampRelevance(agent?.score ?? local.score);
    const reason = (agent?.reason ?? local.reason).slice(0, 180);
    tally.scored += 1;
    await setStage(input.database, item.id, "scored", score, reason, null);
    if (score < RELEVANCE_THRESHOLD) {
      await setStage(input.database, item.id, "dropped", score, reason, null);
      tally.filtered += 1;
      continue;
    }
    await setStage(input.database, item.id, "kept", score, reason, null);
    const leadId = await saveInterpretedLead(input.database, input.source, item, dictionaries, origin);
    await setStage(input.database, item.id, "interpreted", score, reason, leadId);
    tally.interpreted += 1;
  }
  return tally;
}

function resolveMode(batch: ScoreBatch): ScoreMode {
  if (batch.mode === "agent" && batch.byUrl.size === 0) return "fallback";
  return batch.mode;
}

async function alreadySettled(database: D1Database, url: string): Promise<boolean> {
  const lead = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(url).first<{ id: string }>();
  if (lead) return true;
  const candidate = await database
    .prepare("SELECT stage FROM policy_candidates WHERE url = ?")
    .bind(url)
    .first<{ stage: string }>();
  return candidate?.stage === "interpreted";
}

async function upsertRaw(
  database: D1Database,
  source: SourceRef,
  item: EligibleNotice,
  body: string | null,
): Promise<string> {
  const now = new Date().toISOString();
  const existing = await database
    .prepare("SELECT id FROM policy_candidates WHERE url = ?")
    .bind(item.url)
    .first<{ id: string }>();
  if (existing) {
    await database
      .prepare(
        `UPDATE policy_candidates
         SET source_id = ?, title = ?, published_at = ?, region = ?, source_name = ?, body = ?,
             stage = 'raw', relevance_score = NULL, relevance_reason = NULL, lead_id = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(source.id, item.title, item.publishedAt, source.region, source.name, body, now, existing.id)
      .run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await database
    .prepare(
      `INSERT INTO policy_candidates (
         id, source_id, title, url, published_at, region, source_name, body, stage, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'raw', ?, ?)`,
    )
    .bind(id, source.id, item.title, item.url, item.publishedAt, source.region, source.name, body, now, now)
    .run();
  return id;
}

async function setStage(
  database: D1Database,
  id: string,
  stage: "scored" | "kept" | "dropped" | "interpreted",
  score: number,
  reason: string,
  leadId: string | null,
): Promise<void> {
  await database
    .prepare(
      `UPDATE policy_candidates
       SET stage = ?, relevance_score = ?, relevance_reason = ?, lead_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(stage, score, reason, leadId, new Date().toISOString(), id)
    .run();
}

async function saveInterpretedLead(
  database: D1Database,
  source: SourceRef,
  item: StoredCandidate,
  dictionaries: TrackDictionary[] | undefined,
  origin: "agent" | "crawl",
): Promise<string> {
  const text = item.body ? `${item.title}\n${item.body}` : item.title;
  const reading = readPolicy(text, dictionaries);
  const facts = extractNoticeFacts(text);
  const angle = (reading.studioAngle || facts.studioAngle || fallbackStudioAngle(text) || angleFromStudioWords(text) || "").slice(0, 500);
  const tracks = reading.tracks;
  const primary = tracks[0] ?? null;
  const scores = skeletonScores(item.title, primary);
  const existing = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(item.url).first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const publishedAt = item.publishedAt || facts.publishedAt || reading.publishedAt || publishedDay(item.title, item.url);
  await database
    .prepare(
      `INSERT INTO leads (
         id, source_id, track_code, title, url, summary, relevant_excerpt, opportunity_note, region, published_at,
         studio_angle, subsidy_note, participation_note, who_can_apply, contact_note, window_note,
         score_capability, score_funding, score_demand, score_policy, score_competition, score_demo, score_total, origin, kind
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'policy')`,
    )
    .bind(
      id,
      source.id,
      primary,
      item.title,
      item.url,
      (facts.subsidyNote || reading.subsidyNote || "").slice(0, 500) || null,
      reading.excerpt || null,
      angle || null,
      source.region,
      publishedAt,
      angle || null,
      facts.subsidyNote || reading.subsidyNote,
      facts.participationNote || reading.participationNote,
      facts.whoCanApply || reading.whoCanApply,
      facts.contactNote || reading.contactNote,
      facts.windowNote || reading.windowNote,
      scores.capability,
      scores.funding_window,
      scores.demand_density,
      scores.policy_heat,
      scores.competition,
      scores.demo_feasibility,
      scores.total,
      origin,
    )
    .run();
  await writeLeadTracks(database, id, tracks);
  return id;
}

function angleFromStudioWords(text: string): string {
  if (/大模型|人工智能/.test(text)) return "通知里有人工智能或大模型场景，可以用智能体或知识库交付其中的软件部分。";
  if (/软件|数字化|数改/.test(text)) return "按通知里的软件或数改要求，用智能体、知识库或 FDE 交付能验收的部分。";
  return "";
}
