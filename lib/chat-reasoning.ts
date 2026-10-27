export type OpenAiChatReasoningOptions = {
  reasoningEffort: "low";
};

/**
 * 只在官方 OpenAI、且模型被 Chat Completions SDK 视为推理模型时打开 reasoningEffort。
 * 默认 gpt-4o-mini 和自定义网关不传这个参数，避免接口 400。
 * 推理发生在供应商侧；对话流不把 chain-of-thought 发给页面。
 *
 * 判定与 @ai-sdk/openai 的 getOpenAILanguageModelCapabilities 对齐：
 * o 系列，以及 gpt-5 及以上里名字不是 `gpt-5-chat*` 这种无次版本 chat 变体的模型。
 */
export function openAiChatReasoningOptions(model: string, baseURL?: string): OpenAiChatReasoningOptions | undefined {
  if (!usesOfficialOpenAI(baseURL)) return undefined;
  if (!isOpenAiReasoningModel(model)) return undefined;
  return { reasoningEffort: "low" };
}

function usesOfficialOpenAI(baseURL: string | undefined): boolean {
  const value = baseURL?.trim();
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "api.openai.com";
  } catch {
    return false;
  }
}

function isOpenAiReasoningModel(model: string): boolean {
  const name = model.trim().toLowerCase();
  if (/^o\d+(?:-|$)/.test(name)) return true;
  const match = /^gpt-(\d+)(?:\.(\d+))?(?:-(.+))?$/.exec(name);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = match[2];
  const variant = match[3] ?? "";
  const isChatAlias = minor == null && variant.startsWith("chat");
  return major >= 5 && !isChatAlias;
}
