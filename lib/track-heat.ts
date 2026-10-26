export const HEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type HeatStat = {
  total: number;
  recent: number;
  previous: number;
  delta: number;
};

/** 近 7 日条数减去再往前 7 日。正数是变热，负数是变冷。 */
export function trackHeat(rows: { code: string; createdAt: string }[], now = Date.now()): Record<string, HeatStat> {
  const recentSince = now - HEAT_WINDOW_MS;
  const previousSince = now - HEAT_WINDOW_MS * 2;
  const map: Record<string, HeatStat> = {};
  for (const row of rows) {
    const stat = map[row.code] ?? { total: 0, recent: 0, previous: 0, delta: 0 };
    stat.total += 1;
    const time = Date.parse(row.createdAt);
    if (!Number.isNaN(time)) {
      if (time >= recentSince) stat.recent += 1;
      else if (time >= previousSince) stat.previous += 1;
    }
    stat.delta = stat.recent - stat.previous;
    map[row.code] = stat;
  }
  return map;
}

export function trendLabel(delta: number): string {
  if (delta > 0) return `↑${delta}`;
  if (delta < 0) return `↓${Math.abs(delta)}`;
  return "—";
}
