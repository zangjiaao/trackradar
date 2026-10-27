import { NOTICE_BODY_LIMIT, storedLeadSummary, storedNoticeBody } from "@/lib/article-attachments";
import { fetchPolicyArticle } from "@/lib/fetch-article";
import { deferHardwareExclusion, exclusionNote, matchTrackWords, textForTrackMatch, type TrackDictionary } from "@/lib/guess";
import { sortTrackCodes, writeLeadTracks } from "@/lib/lead-tracks";
import { publishedDay } from "@/lib/lead-presentation";
import { acceptPolicyAssessment, isTemplateReading, leadNeedsAgentReading, type PolicyAssessment } from "@/lib/policy-assess";
import {
  COLLECT_PER_SOURCE,
  partitionListItems,
  selectCollectBatch,
  type EligibleNotice,
  type ListNotice,
  type ScanTally,
  type ScoreMode,
} from "@/lib/policy-collect";
import { assessCandidatesWithAgent, type AssessBatch, type ScoreInput } from "@/lib/policy-score";
import { skeletonScores } from "@/lib/scoring";

const BODY_RESERVE_MS = 8_000;

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
  scoreBatch?: (items: ScoreInput[]) => Promise<AssessBatch>;
}): Promise<ScanTally> {
  const now = input.now ?? new Date();
  const dictionaries = input.dictionaries;
  const deadline = input.deadline ?? Number.POSITIVE_INFINITY;
  const limit = input.limit ?? COLLECT_PER_SOURCE;
  const origin = input.origin ?? "agent";
  const fetchArticle = input.fetchArticle ?? fetchPolicyArticle;
  const scoreBatch = input.scoreBatch ?? assessCandidatesWithAgent;
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
  const selected = selectCollectBatch(fresh, limit);
  tally.budgetSkipped = fresh.length - selected.length;

  const stored: StoredCandidate[] = [];
  for (const item of selected) {
    let body: string | null = null;
    let publishedAt = item.publishedAt;
    if (Date.now() < deadline - BODY_RESERVE_MS) {
      tally.bodyReads += 1;
      const article = await fetchArticle(item.url, { deadline });
      if (article) {
        body = storedNoticeBody(item.title, article.text, NOTICE_BODY_LIMIT);
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
  if (tally.scorer !== "agent") return tally;

  for (const item of stored) {
    const text = item.body ? `${item.title}\n${item.body}` : item.title;
    const agent = batch.byUrl.get(item.url);
    if (!agent) continue;
    const score = agent.score;
    const reason = agent.reason.slice(0, 180);
    tally.scored += 1;
    if (exclusionNote(text) && !deferHardwareExclusion(text)) {
      await setStage(input.database, item.id, "dropped", 0, "正文命中汽车、机器人、具身、芯片或服务器制造。", null);
      tally.filtered += 1;
      continue;
    }
    await setStage(input.database, item.id, "scored", score, reason, null);
    if (!acceptPolicyAssessment(agent)) {
      await setStage(input.database, item.id, "dropped", score, reason || "与工作室无关，或没有可用解读。", null);
      const existing = await policyLeadReading(input.database, item.url);
      if (existing && leadNeedsAgentReading(existing)) {
        await removeUnreadableLead(input.database, existing.id, item.url, reason || "与工作室无关，或没有可用解读。");
      }
      tally.filtered += 1;
      continue;
    }
    await setStage(input.database, item.id, "kept", score, reason, null);
    const leadId = await saveInterpretedLead(input.database, input.source, item, agent, dictionaries, origin);
    await setStage(input.database, item.id, "interpreted", score, reason, leadId);
    tally.interpreted += 1;
  }
  return tally;
}

function resolveMode(batch: AssessBatch): ScoreMode {
  if (batch.mode === "agent" && batch.byUrl.size === 0) return "fallback";
  return batch.mode;
}

type LeadReading = {
  id: string;
  kind: string | null;
  summary: string | null;
  opportunity_note: string | null;
  studio_angle: string | null;
};

async function policyLeadReading(database: D1Database, url: string): Promise<LeadReading | null> {
  return database
    .prepare("SELECT id, kind, summary, opportunity_note, studio_angle FROM leads WHERE url = ?")
    .bind(url)
    .first<LeadReading>();
}

async function alreadySettled(database: D1Database, url: string): Promise<boolean> {
  const lead = await policyLeadReading(database, url);
  if (lead && (lead.kind === "case" || !leadNeedsAgentReading(lead))) return true;
  if (lead) return false;
  const candidate = await database
    .prepare("SELECT stage FROM policy_candidates WHERE url = ?")
    .bind(url)
    .first<{ stage: string }>();
  return candidate?.stage === "interpreted";
}

async function removeUnreadableLead(database: D1Database, leadId: string, url: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `UPDATE policy_candidates
       SET stage = 'dropped', lead_id = NULL, relevance_reason = ?, updated_at = ?
       WHERE url = ? OR lead_id = ?`,
    )
    .bind(reason, now, url, leadId)
    .run();
  await database.prepare("DELETE FROM lead_tracks WHERE lead_id = ?").bind(leadId).run();
  await database.prepare("DELETE FROM leads WHERE id = ?").bind(leadId).run();
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

function optionalFact(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || isTemplateReading(text)) return null;
  return text.slice(0, 500);
}

async function saveInterpretedLead(
  database: D1Database,
  source: SourceRef,
  item: StoredCandidate,
  assessment: PolicyAssessment,
  dictionaries: TrackDictionary[] | undefined,
  origin: "agent" | "crawl",
): Promise<string> {
  const text = item.body ? `${item.title}\n${item.body}` : item.title;
  const reading = assessment.reading.replace(/\s+/g, " ").trim().slice(0, 500);
  const summary = storedLeadSummary(reading, item.body);
  const tracks = sortTrackCodes(matchTrackWords(textForTrackMatch(text), dictionaries).map((match) => match.code));
  const primary = tracks[0] ?? null;
  const scores = skeletonScores(item.title, primary);
  const existing = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(item.url).first<{ id: string }>();
  const publishedAt = item.publishedAt || publishedDay(item.title, item.url);
  if (existing) {
    await database
      .prepare(
        `UPDATE leads
         SET summary = ?, opportunity_note = ?, studio_angle = ?,
             subsidy_note = ?, participation_note = ?, who_can_apply = ?, contact_note = ?, window_note = ?,
             published_at = COALESCE(?, published_at)
         WHERE id = ?`,
      )
      .bind(
        summary,
        reading,
        reading,
        optionalFact(assessment.subsidy),
        optionalFact(assessment.participation),
        optionalFact(assessment.threshold),
        optionalFact(assessment.contact),
        optionalFact(assessment.window),
        publishedAt,
        existing.id,
      )
      .run();
    await writeLeadTracks(database, existing.id, tracks);
    return existing.id;
  }
  const id = crypto.randomUUID();
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
      summary,
      null,
      reading,
      source.region,
      publishedAt,
      reading,
      optionalFact(assessment.subsidy),
      optionalFact(assessment.participation),
      optionalFact(assessment.threshold),
      optionalFact(assessment.contact),
      optionalFact(assessment.window),
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
