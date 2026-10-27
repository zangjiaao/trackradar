/** 与 migrations/0011_lead_kind.sql 的归类一致。 */
export const CASE_SITES = ["opc", "zbj", "fiverr", "58", "xhs", "xianyu", "taobao", "channels"] as const;

export type LeadKind = "policy" | "case";

export function inferLeadKind(origin: string | null | undefined, site: string | null | undefined): LeadKind {
  if (origin === "manual") return "case";
  if (site && (CASE_SITES as readonly string[]).includes(site)) return "case";
  return "policy";
}
