import { TRACK_MATCH_ORDER } from "@/lib/guess";

const TRACK_CODE = /^T(0[1-9]|10)$/;

export function isTrackCode(value: string): boolean {
  return TRACK_CODE.test(value);
}

export function uniqueTrackCodes(values: Iterable<string>): string[] {
  const found: string[] = [];
  for (const value of values) {
    if (!isTrackCode(value) || found.includes(value)) continue;
    found.push(value);
  }
  return found.slice(0, 10);
}

/** 按具体程度排序，第一个就是主赛道。 */
export function sortTrackCodes(values: Iterable<string>): string[] {
  const rank = new Map<string, number>(TRACK_MATCH_ORDER.map((code, index) => [code, index]));
  return uniqueTrackCodes(values).sort((left, right) => (rank.get(left) ?? 99) - (rank.get(right) ?? 99));
}

export async function writeLeadTracks(database: D1Database, leadId: string, codes: string[]): Promise<void> {
  for (const code of sortTrackCodes(codes)) {
    await database.prepare("INSERT OR IGNORE INTO lead_tracks (lead_id, track_code) VALUES (?, ?)").bind(leadId, code).run();
  }
}
