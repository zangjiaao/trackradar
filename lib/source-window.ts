import { exclusionNote, guessTrack } from "@/lib/guess";

const REGIONS = ["上海", "北京", "深圳", "杭州", "西安", "银川", "宁夏"];

export type DatedItem = { iso: string; precision: "day" | "year" };

export function extractItemDate(title: string, url: string): DatedItem | null {
  const text = `${url} ${title}`;
  const day = text.match(/(20\d{2})(\d{2})(\d{2})/);
  if (day) {
    const month = Number(day[2]);
    const date = Number(day[3]);
    if (month >= 1 && month <= 12 && date >= 1 && date <= 31) {
      return { iso: `${day[1]}-${day[2]}-${day[3]}`, precision: "day" };
    }
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

export type KeptItem = { title: string; url: string; track: string; dated: boolean };

export function selectOpportunityItems(
  items: { title: string; url: string }[],
  lookbackDays: number,
  now = new Date(),
): { keep: KeptItem[]; droppedOld: number; droppedExcluded: number; droppedUnmapped: number } {
  const keep: KeptItem[] = [];
  let droppedOld = 0;
  let droppedExcluded = 0;
  let droppedUnmapped = 0;
  for (const item of items) {
    if (exclusionNote(`${item.title}\n${item.url}`)) {
      droppedExcluded += 1;
      continue;
    }
    const found = extractItemDate(item.title, item.url);
    if (!withinLookback(found, lookbackDays, now)) {
      droppedOld += 1;
      continue;
    }
    const track = guessTrack(item.title);
    if (!track) {
      droppedUnmapped += 1;
      continue;
    }
    keep.push({ title: item.title, url: item.url, track, dated: Boolean(found) });
  }
  return { keep, droppedOld, droppedExcluded, droppedUnmapped };
}

export function normalizeLookback(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 365;
  return Math.max(30, Math.min(800, Math.round(number)));
}
