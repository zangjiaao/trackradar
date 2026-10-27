const REGIONS = ["上海", "北京", "深圳", "杭州", "西安", "银川", "宁夏"];

export type DatedItem = { iso: string; precision: "day" | "year" };

function asDay(year: string, monthText: string, dayText: string): DatedItem | null {
  const month = Number(monthText);
  const date = Number(dayText);
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  return { iso: `${year}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`, precision: "day" };
}

export function extractItemDate(title: string, url: string): DatedItem | null {
  const text = `${url} ${title}`;
  const dashed = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (dashed) {
    const found = asDay(dashed[1], dashed[2], dashed[3]);
    if (found) return found;
  }
  const chinese = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (chinese) {
    const found = asDay(chinese[1], chinese[2], chinese[3]);
    if (found) return found;
  }
  const day = text.match(/(20\d{2})(\d{2})(\d{2})/);
  if (day) {
    const found = asDay(day[1], day[2], day[3]);
    if (found) return found;
  }
  const year = text.match(/20\d{2}/);
  if (year) return { iso: `${year[0]}-12-31`, precision: "year" };
  return null;
}

/** 有完整日期时按回看天数过滤。只有年份时，保留今年和去年，对应「约一年」。没有日期的列表条目先留下。 */
export function withinLookback(found: DatedItem | null, lookbackDays: number, now: Date): boolean {
  if (!found) return true;
  if (found.precision === "year") return Number(found.iso.slice(0, 4)) >= now.getUTCFullYear() - 1;
  const parsed = Date.parse(`${found.iso}T00:00:00Z`);
  if (Number.isNaN(parsed)) return true;
  return parsed >= now.getTime() - lookbackDays * 86_400_000;
}

export function regionsInText(text: string | null | undefined): string[] {
  if (!text) return [];
  return REGIONS.filter((region) => text.includes(region));
}

export function normalizeLookback(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 365;
  return Math.max(30, Math.min(800, Math.round(number)));
}
