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
  keywords: string;
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

export const MATERIAL_SITES = [
  { value: "opc", label: "OPC 社区" },
  { value: "zbj", label: "猪八戒" },
  { value: "58", label: "58同城" },
  { value: "xhs", label: "小红书" },
  { value: "xianyu", label: "闲鱼" },
  { value: "taobao", label: "淘宝" },
  { value: "channels", label: "视频号" },
  { value: "other", label: "其他" },
] as const;

export type MaterialSite = (typeof MATERIAL_SITES)[number]["value"];

export const DEFAULT_MATERIAL_SITES =
  "OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号。这些站点由人工打开查找，再回到机会页录入。不自动爬取。";

export const ORIGIN_LABEL: Record<string, string> = {
  seed: "种子",
  crawl: "试抓",
  manual: "录入",
  agent: "采集",
};

export type AgentTaskRow = {
  id: string;
  name: string;
  cadence: "daily" | "weekly";
  lookback_days: number;
  instruction: string;
  enabled: number;
  created_at: string;
};

export type LeadRow = {
  id: string;
  source_id: string | null;
  track_code: string | null;
  title: string;
  url: string;
  summary: string | null;
  relevant_excerpt: string | null;
  opportunity_note: string | null;
  region: string | null;
  side: string | null;
  site: string | null;
  source_name: string | null;
  published_at: string | null;
  track_codes: string[];
  score_capability: number | null;
  score_funding: number | null;
  score_demand: number | null;
  score_policy: number | null;
  score_competition: number | null;
  score_demo: number | null;
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
