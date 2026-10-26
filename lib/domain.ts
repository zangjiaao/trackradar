export const WEIGHTS = {
  capability: 0.25,
  funding_window: 0.2,
  demand_density: 0.2,
  policy_heat: 0.15,
  competition: 0.1,
  demo_feasibility: 0.1,
} as const;

export const WEIGHT_LABELS: { key: keyof typeof WEIGHTS; label: string }[] = [
  { key: "capability", label: "能力匹配" },
  { key: "funding_window", label: "资金/窗口" },
  { key: "demand_density", label: "需求密度" },
  { key: "policy_heat", label: "政策热度" },
  { key: "competition", label: "竞争（低更好）" },
  { key: "demo_feasibility", label: "demo 可行" },
];

export const PLATFORMS = ["xianyu", "taobao", "channels"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const SIDES = ["demand", "supply", "content"] as const;
export type Side = (typeof SIDES)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  xianyu: "闲鱼",
  taobao: "淘宝",
  channels: "视频号",
};

export const SIDE_LABEL: Record<Side, string> = {
  demand: "需求",
  supply: "供给",
  content: "内容",
};

export type TrackRow = {
  code: string;
  name: string;
  summary: string;
  studio_fit: string;
  sort_order: number;
};

export type SourceRow = {
  id: string;
  region: string;
  name: string;
  list_url: string;
  adapter: string;
  enabled: number;
  notes: string | null;
};

export type LeadRow = {
  id: string;
  source_id: string | null;
  track_code: string | null;
  title: string;
  url: string;
  summary: string | null;
  region: string | null;
  score_total: number | null;
  origin: string;
  created_at: string;
};

export type SampleRow = {
  id: string;
  sampled_at: string;
  platform: Platform;
  keyword: string | null;
  title: string;
  url: string;
  side: Side | null;
  price_or_signal: string | null;
  track_guess: string | null;
  note: string | null;
};

export type PromptRow = {
  id: string;
  version: string;
  name: string;
  system_prompt: string;
  weights_json: string;
  is_active: number;
  updated_at: string | null;
};

export type KeywordSetRow = {
  id: string;
  name: string;
  platform: string;
  keywords: string;
  track_code: string | null;
};

export type CrawlJobRow = {
  id: string;
  source_id: string | null;
  kind: string;
  status: string;
  message: string | null;
  created_at: string;
};

export type ParsedSample = {
  title: string;
  url: string;
  price_or_signal: string | null;
  track_guess: string | null;
  note: string | null;
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function isSide(value: string): value is Side {
  return (SIDES as readonly string[]).includes(value);
}
