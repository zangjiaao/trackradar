import { fetchPolicyArticle } from "@/lib/fetch-article";
import { readPolicy } from "@/lib/policy-read";
import { loadTrackDictionaries } from "@/lib/queries";

const SHALLOW = `SELECT id, title, url, origin, kind FROM leads
  WHERE kind = 'policy'
    AND origin IN ('agent', 'crawl', 'seed')
    AND (studio_angle IS NULL OR length(trim(studio_angle)) = 0)
  ORDER BY created_at DESC
  LIMIT ?`;

export async function rereadLeads(
  database: D1Database,
  input: { url?: string | null; limit?: number } = {},
): Promise<{ updated: number; checked: number; notes: string[] }> {
  const dictionaries = await loadTrackDictionaries(database);
  const limit = Math.max(1, Math.min(12, input.limit ?? 8));
  const url = input.url?.trim() || "";
  const selected = url
    ? await database
        .prepare("SELECT id, title, url, origin, kind FROM leads WHERE url = ?")
        .bind(url)
        .all<{ id: string; title: string; url: string; origin: string; kind: string }>()
    : await database.prepare(SHALLOW).bind(limit).all<{ id: string; title: string; url: string; origin: string; kind: string }>();
  const notes: string[] = [];
  let updated = 0;
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
    const reading = readPolicy(`${lead.title}\n${article.text}`, dictionaries);
    const published = article.publishedAt || reading.publishedAt;
    if (!reading.studioAngle && !reading.subsidyNote && !reading.participationNote && !reading.whoCanApply && !reading.contactNote) {
      notes.push(`${lead.title}：正文里没有抽出机会或福利`);
      continue;
    }
    await database
      .prepare(
        `UPDATE leads
         SET summary = ?, relevant_excerpt = ?, opportunity_note = ?, published_at = COALESCE(?, published_at),
             studio_angle = ?, subsidy_note = ?, participation_note = ?, who_can_apply = ?, contact_note = ?, window_note = ?
         WHERE id = ?`,
      )
      .bind(
        reading.subsidyNote,
        reading.excerpt || null,
        reading.studioAngle,
        published,
        reading.studioAngle,
        reading.subsidyNote,
        reading.participationNote,
        reading.whoCanApply,
        reading.contactNote,
        reading.windowNote,
        lead.id,
      )
      .run();
    updated += 1;
    notes.push(`${lead.title}：已按正文重写`);
  }
  return { updated, checked: selected.results.length, notes };
}
