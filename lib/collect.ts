export const DAILY_CRON = "0 2 * * *";
export const WEEKLY_CRON = "0 1 * * 1";

export type Cadence = "daily" | "weekly";

export type CollectConfig = {
  enabled: boolean;
  cadence: Cadence;
};

export function isCadence(value: string): value is Cadence {
  return value === "daily" || value === "weekly";
}

export function cadenceLabel(cadence: Cadence): string {
  return cadence === "weekly" ? "每周一 09:00（北京时间）" : "每天 10:00（北京时间）";
}

export function collectFromMap(map: Record<string, string>): CollectConfig {
  const cadence = map.collect_cadence && isCadence(map.collect_cadence) ? map.collect_cadence : "daily";
  const enabled = map.collect_enabled === undefined ? true : map.collect_enabled === "1";
  return { enabled, cadence };
}

/** 配置里的周期决定哪一条 Worker Cron 记占位，其余记为跳过。 */
export function decideCron(cron: string, collect: CollectConfig): "run" | "skip" {
  if (!collect.enabled) return "skip";
  if (collect.cadence === "weekly") return cron === WEEKLY_CRON ? "run" : "skip";
  return cron === DAILY_CRON ? "run" : "skip";
}
