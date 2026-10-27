import { env } from "cloudflare:workers";
import { collectFromMap, type Cadence, type CollectConfig } from "@/lib/collect";
import { getDb } from "@/lib/db";
import { DEFAULT_MATERIAL_SITES } from "@/lib/domain";
import { normalizeTavilyKey, presentTavilyKey } from "@/lib/web-search";

export type { Cadence, CollectConfig };

export type PublicModelConfig = {
  configured: boolean;
  from: "settings" | "env" | null;
  model: string;
  baseURL: string;
  keyHint: string | null;
};

export type ModelSecrets = {
  apiKey: string;
  baseURL?: string;
  model: string;
  from: "settings" | "env";
};

export async function readSettingsMap(): Promise<Record<string, string>> {
  const { results } = await getDb().prepare("SELECT key, value FROM app_settings").all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of results) map[row.key] = row.value;
  return map;
}

export async function readCollectConfig(): Promise<CollectConfig> {
  return collectFromMap(await readSettingsMap());
}

function keyHint(apiKey: string): string {
  const tail = apiKey.slice(-4);
  return `已保存，末四位 ${tail}`;
}

export async function readModelConfig(): Promise<ModelSecrets | null> {
  let map: Record<string, string> = {};
  try {
    map = await readSettingsMap();
  } catch {
    map = {};
  }
  const storedKey = map.openai_api_key?.trim();
  const envKey = env.OPENAI_API_KEY?.trim();
  const apiKey = storedKey || envKey;
  if (!apiKey) return null;
  const baseURL = (map.openai_base_url || env.OPENAI_BASE_URL || "").trim();
  const model = (map.openai_model || env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  return {
    apiKey,
    baseURL: baseURL || undefined,
    model,
    from: storedKey ? "settings" : "env",
  };
}

export async function readPublicModel(): Promise<PublicModelConfig> {
  let map: Record<string, string> = {};
  try {
    map = await readSettingsMap();
  } catch {
    map = {};
  }
  const baseURL = (map.openai_base_url || env.OPENAI_BASE_URL || "").trim();
  const model = (map.openai_model || env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const storedKey = map.openai_api_key?.trim();
  const envKey = env.OPENAI_API_KEY?.trim();
  if (!storedKey && !envKey) {
    return { configured: false, from: null, model, baseURL, keyHint: null };
  }
  return {
    configured: true,
    from: storedKey ? "settings" : "env",
    model,
    baseURL,
    keyHint: storedKey ? keyHint(storedKey) : "使用环境变量 OPENAI_API_KEY",
  };
}

async function putSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

export async function saveModelSettings(input: { apiKey?: string; clearKey?: boolean; baseURL?: string; model?: string }): Promise<void> {
  if (input.clearKey) {
    await getDb().prepare("DELETE FROM app_settings WHERE key = 'openai_api_key'").run();
  } else if (input.apiKey !== undefined && input.apiKey.trim()) {
    const apiKey = input.apiKey.trim();
    if (apiKey.length < 8 || apiKey.length > 400 || /[\r\n]/.test(apiKey)) {
      throw new Error("API Key 长度或格式不对。");
    }
    await putSetting("openai_api_key", apiKey);
  }
  if (input.baseURL !== undefined) {
    const baseURL = input.baseURL.trim();
    if (baseURL && !/^https?:\/\//i.test(baseURL)) throw new Error("Base URL 需要以 http:// 或 https:// 开头。");
    if (baseURL.length > 300) throw new Error("Base URL 过长。");
    await putSetting("openai_base_url", baseURL);
  }
  if (input.model !== undefined) {
    const model = input.model.trim();
    if (!model || model.length > 80 || /\s/.test(model)) throw new Error("模型名不能为空，且不能含空格。");
    await putSetting("openai_model", model);
  }
}

export async function readTavilyApiKey(): Promise<string | null> {
  let map: Record<string, string> = {};
  try {
    map = await readSettingsMap();
  } catch {
    map = {};
  }
  const stored = map.tavily_api_key?.trim();
  if (stored) return stored;
  return env.TAVILY_API_KEY?.trim() || null;
}

export async function readPublicTavily(): Promise<ReturnType<typeof presentTavilyKey>> {
  let map: Record<string, string> = {};
  try {
    map = await readSettingsMap();
  } catch {
    map = {};
  }
  return presentTavilyKey(map.tavily_api_key, env.TAVILY_API_KEY);
}

export async function saveTavilySettings(input: { apiKey?: string; clearKey?: boolean }): Promise<void> {
  if (input.clearKey) {
    await getDb().prepare("DELETE FROM app_settings WHERE key = 'tavily_api_key'").run();
    return;
  }
  if (input.apiKey === undefined || !input.apiKey.trim()) return;
  const parsed = normalizeTavilyKey(input.apiKey);
  if (!parsed.ok) throw new Error(parsed.error);
  await putSetting("tavily_api_key", parsed.key);
}

export async function readMaterialSites(): Promise<string> {
  const map = await readSettingsMap();
  return map.material_sites?.trim() || DEFAULT_MATERIAL_SITES;
}

export async function saveMaterialSites(text: string): Promise<void> {
  const value = text.trim();
  if (value.length < 4) throw new Error("站点说明过短。");
  if (value.length > 800) throw new Error("站点说明过长。");
  await putSetting("material_sites", value);
}

export async function saveCollectSettings(input: { enabled: boolean; cadence: Cadence }): Promise<void> {
  await putSetting("collect_enabled", input.enabled ? "1" : "0");
  await putSetting("collect_cadence", input.cadence);
}

export async function setSourceEnabled(id: string, enabled: boolean): Promise<void> {
  const existing = await getDb().prepare("SELECT id FROM sources WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) throw new Error("找不到该信源。");
  await getDb().prepare("UPDATE sources SET enabled = ? WHERE id = ?").bind(enabled ? 1 : 0, id).run();
}
