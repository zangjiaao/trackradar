import { getDb } from "@/lib/db";
import { finalizeOpportunity, type OpportunityFields } from "@/lib/opportunity-draft";
import { recordWork } from "@/lib/work-log";

export async function saveOpportunity(input: OpportunityFields, kind: "manual_entry" | "tool_add_opportunity") {
  const lead = finalizeOpportunity(input);
  const database = getDb();
  const existing = await database.prepare("SELECT id FROM leads WHERE url = ?").bind(lead.url).first<{ id: string }>();
  if (existing) throw new Error("这条链接已经在机会清单里。");
  const id = crypto.randomUUID();
  await database
    .prepare(
      `INSERT INTO leads (
         id, source_id, track_code, title, url, summary, region, side, site,
         score_capability, score_funding, score_demand, score_policy, score_competition, score_demo, score_total, origin
       ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
    )
    .bind(
      id,
      lead.track_code,
      lead.title,
      lead.url,
      lead.summary,
      lead.region,
      lead.side,
      lead.site,
      lead.scores.capability,
      lead.scores.funding_window,
      lead.scores.demand_density,
      lead.scores.policy_heat,
      lead.scores.competition,
      lead.scores.demo_feasibility,
      lead.scores.total,
    )
    .run();
  const verb = kind === "manual_entry" ? "录入机会" : "对话写入机会";
  await recordWork({ kind, status: "done", message: `${verb}：${lead.title}｜${lead.url}` });
  return { id, lead };
}
