import type { CaseAuthor, CaseAuthorFields, RelatedCase } from "./domain";
import type { OpcItem } from "./opc-feed";
import { opcProfileUrl } from "./opc-feed";

/** Enrich metadata only: leave assessment, attempts, stage and lead timestamps intact. */
export function opcAuthorStatements(database: D1Database, item: OpcItem): D1PreparedStatement[] {
  const author = item.author;
  if (!author) return [];
  return [
    database.prepare(`INSERT INTO opc_authors (id, username, name, bio, location, verified) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = COALESCE(excluded.username, opc_authors.username),
        name = COALESCE(excluded.name, opc_authors.name),
        bio = COALESCE(excluded.bio, opc_authors.bio),
        location = COALESCE(excluded.location, opc_authors.location),
        verified = COALESCE(excluded.verified, opc_authors.verified)`)
      .bind(author.id, author.username, author.name, author.bio, author.location,
        author.verified === null ? null : Number(author.verified)),
    database.prepare(`UPDATE case_candidates SET author_id = ?, payload = json_set(payload, '$.author', json(?)) WHERE url = ?`)
      .bind(author.id, JSON.stringify(author), item.url),
  ];
}

type AuthorRow = Omit<CaseAuthor, "verified" | "profile_url"> & { lead_id: string; verified: number | null };
type Sibling = RelatedCase & { author_id: string; total: number };
type LeadIdentity = { id: string; kind: string; site: string | null; origin: string };
const eligible = (row: LeadIdentity) => row.kind === "case" && row.site === "opcquan" && row.origin === "agent";
// D1 limits bound parameters per statement. Pages can contain 200 cases.
const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / 80) }, (_, i) => items.slice(i * 80, i * 80 + 80));

/** Shared by the dashboard and read-only Agent APIs; no per-card database queries. */
export async function attachCaseAuthors<T extends LeadIdentity>(database: D1Database, rows: T[]): Promise<(T & CaseAuthorFields)[]> {
  const ids = rows.filter(eligible).map((row) => row.id);
  const authors = new Map<string, CaseAuthor>();
  for (const group of chunks(ids)) {
    const { results } = await database.prepare(`SELECT cc.lead_id, a.* FROM case_candidates cc
      JOIN opc_authors a ON a.id = cc.author_id
      WHERE cc.stage = 'interpreted' AND cc.lead_id IN (${group.map(() => "?").join(",")})`)
      .bind(...group).all<AuthorRow>();
    for (const row of results) {
      authors.set(row.lead_id, {
        id: row.id, username: row.username, name: row.name, bio: row.bio, location: row.location,
        verified: row.verified === null ? null : row.verified === 1, profile_url: opcProfileUrl(row.username),
      });
    }
  }
  const siblings = new Map<string, Sibling[]>();
  for (const group of chunks([...new Set([...authors.values()].map((author) => author.id))])) {
    const { results } = await database.prepare(`WITH collected AS (
        SELECT DISTINCT cc.author_id, l.id, l.title, l.url, l.created_at
        FROM case_candidates cc JOIN leads l ON l.id = cc.lead_id
        WHERE cc.author_id IN (${group.map(() => "?").join(",")}) AND cc.stage = 'interpreted'
          AND l.kind = 'case' AND l.site = 'opcquan' AND l.origin = 'agent'
      ), ranked AS (
        SELECT *, COUNT(*) OVER (PARTITION BY author_id) AS total,
          ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at DESC, id DESC) AS position
        FROM collected
      ) SELECT author_id, id, title, url, total FROM ranked WHERE position <= 6 ORDER BY author_id, position`)
      .bind(...group).all<Sibling>();
    for (const row of results) {
      const list = siblings.get(row.author_id) ?? [];
      list.push(row);
      siblings.set(row.author_id, list);
    }
  }
  return rows.map((row) => {
    const author = eligible(row) ? authors.get(row.id) ?? null : null;
    const related = author ? siblings.get(author.id) ?? [] : [];
    return { ...row, author,
      related_cases: related.filter((item) => item.id !== row.id).slice(0, 5).map(({ id, title, url }) => ({ id, title, url })),
      related_cases_count: Math.max(0, (related[0]?.total ?? 1) - 1),
    };
  });
}
