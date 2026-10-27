import { NOTICE_BODY_LIMIT, storedLeadSummary, storedNoticeBody } from "@/lib/article-attachments";
import { fetchPolicyArticle } from "@/lib/fetch-article";
import { acceptPolicyAssessment, isTemplateReading } from "@/lib/policy-assess";
import { assessCandidatesWithAgent } from "@/lib/policy-score";

const RECENT = `SELECT id, title, url, origin, kind FROM leads
  WHERE kind = 'policy'
    AND origin IN ('agent', 'crawl', 'seed')
  ORDER BY created_at DESC
  LIMIT ?`;

function optionalFact(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || isTemplateReading(text)) return null;
  return text.slice(0, 500);
}

async function removePolicyLead(database: D1Database, lead: { id: string; url: string }, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `UPDATE policy_candidates
       SET stage = 'dropped', lead_id = NULL, relevance_reason = ?, updated_at = ?
       WHERE url = ? OR lead_id = ?`,
    )
    .bind(reason, now, lead.url, lead.id)
    .run();
  await database.prepare("DELETE FROM lead_tracks WHERE lead_id = ?").bind(lead.id).run();
  await database.prepare("DELETE FROM leads WHERE id = ?").bind(lead.id).run();
}

/** 重新解读走模型。没有密钥时不改政策页，也不用本地套话填解读。 */
export async function rereadLeads(
  database: D1Database,
  input: { url?: string | null; limit?: number } = {},
): Promise<{ updated: number; removed: number; checked: number; notes: string[]; message: string }> {
  const limit = Math.max(1, Math.min(12, input.limit ?? 8));
  const url = input.url?.trim() || "";
  const selected = url
    ? await database
        .prepare("SELECT id, title, url, origin, kind FROM leads WHERE url = ?")
        .bind(url)
        .all<{ id: string; title: string; url: string; origin: string; kind: string }>()
    : await database.prepare(RECENT).bind(limit).all<{ id: string; title: string; url: string; origin: string; kind: string }>();
  const notes: string[] = [];
  const ready: Array<{ id: string; title: string; url: string; body: string }> = [];
  for (const lead of selected.results) {
    if (lead.kind === "case") {
      notes.push(`${lead.title}：案例不按政策正文重写`);
      continue;
    }
    const article = await fetchPolicyArticle(lead.url);
    if (!article || article.text.length < 180) {
      notes.push(`${lead.title}：没有读到正文`);
      continue;
    }
    ready.push({
      id: lead.id,
      title: lead.title,
      url: lead.url,
      body: storedNoticeBody(lead.title, article.text, NOTICE_BODY_LIMIT),
    });
  }
  if (ready.length === 0) {
    return { updated: 0, removed: 0, checked: selected.results.length, notes, message: notes[0] ?? "这次没有读到可以重写的正文。" };
  }
  const batch = await assessCandidatesWithAgent(
    ready.map((item) => ({ url: item.url, title: item.title, body: item.body, region: "", sourceName: "" })),
  );
  if (batch.mode !== "agent") {
    const message = batch.mode === "fallback" ? "模型未返回，未重写。" : "未配置模型，未重写。";
    return { updated: 0, removed: 0, checked: selected.results.length, notes: [message], message };
  }
  let updated = 0;
  let removed = 0;
  for (const item of ready) {
    const assessment = batch.byUrl.get(item.url);
    if (!assessment) {
      notes.push(`${item.title}：模型没有返回这条`);
      continue;
    }
    if (!acceptPolicyAssessment(assessment)) {
      await removePolicyLead(database, item, assessment.reason || "与工作室无关");
      removed += 1;
      notes.push(`${item.title}：与工作室无关，已从政策页移除`);
      continue;
    }
    const reading = assessment.reading.replace(/\s+/g, " ").trim().slice(0, 500);
    const summary = storedLeadSummary(reading, item.body);
    await database
      .prepare(
        `UPDATE leads
         SET summary = ?, opportunity_note = ?, studio_angle = ?,
             subsidy_note = ?, participation_note = ?, who_can_apply = ?, contact_note = ?, window_note = ?
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
        item.id,
      )
      .run();
    await database
      .prepare(
        `UPDATE policy_candidates
         SET stage = 'interpreted', relevance_score = ?, relevance_reason = ?, lead_id = ?, updated_at = ?
         WHERE url = ?`,
      )
      .bind(assessment.score, assessment.reason, item.id, new Date().toISOString(), item.url)
      .run();
    updated += 1;
    notes.push(`${item.title}：已按模型解读重写`);
  }
  const message = `重写 ${updated} 条，从政策页移除 ${removed} 条。`;
  return { updated, removed, checked: selected.results.length, notes, message };
}
