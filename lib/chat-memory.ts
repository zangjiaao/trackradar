import type { UIMessage } from "ai";

export const CHAT_MESSAGES_KEY = "trackradar.chat.messages";
export const CHAT_DRAFT_KEY = "trackradar.chat.draft";
export const CHAT_ACTIVE_KEY = "trackradar.chat.active";

export const NEW_CHAT_TITLE = "新对话";
export const CHAT_TITLE_LIMIT = 18;
export const MAX_CHAT_SESSIONS = 100;
export const MAX_CHAT_MESSAGES = 300;
export const MAX_CHAT_MESSAGE_JSON = 1_500_000;
export const MAX_CHAT_DRAFT = 20_000;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ChatSessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatSessionDetail = ChatSessionSummary & {
  draft: string;
  messages: UIMessage[];
};

function isMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export function coerceStoredMessages(input: unknown): UIMessage[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isMessage);
}

export function parseStoredMessages(raw: string | null): UIMessage[] {
  if (!raw) return [];
  try {
    return coerceStoredMessages(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function assertSessionId(id: string): void {
  if (!SESSION_ID_PATTERN.test(id)) throw new Error("会话 id 不正确。");
}

export function prepareSessionMessages(input: unknown): UIMessage[] {
  if (!Array.isArray(input)) throw new Error("messages 需要是数组。");
  const messages = coerceStoredMessages(input);
  if (messages.length !== input.length) throw new Error("有消息缺少 id、role 或 parts。");
  if (messages.length > MAX_CHAT_MESSAGES) throw new Error(`一个会话最多保留 ${MAX_CHAT_MESSAGES} 条消息。`);
  for (const message of messages) {
    if (JSON.stringify(message).length > MAX_CHAT_MESSAGE_JSON) {
      throw new Error("有一条消息太大，没能写入会话。");
    }
  }
  return messages;
}

export function prepareSessionDraft(input: unknown): string {
  if (typeof input !== "string") throw new Error("草稿需要是字符串。");
  if (input.length > MAX_CHAT_DRAFT) throw new Error("草稿太长。");
  return input;
}

function textParts(message: { parts?: unknown }): string[] {
  if (!Array.isArray(message.parts)) return [];
  return message.parts.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const candidate = part as { type?: unknown; text?: unknown };
    return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : [];
  });
}

function messageText(message: { parts?: unknown }): string {
  return textParts(message).join(" ").replace(/\s+/g, " ").trim();
}

export function messageMarkdownSource(message: { parts?: unknown }): string {
  return textParts(message)
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function truncateTitle(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= CHAT_TITLE_LIMIT) return text;
  return `${chars.slice(0, CHAT_TITLE_LIMIT).join("")}…`;
}

export function sessionTitleFromMessages(messages: readonly { role?: string; parts?: unknown }[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser ? messageText(firstUser) : "";
  if (!text) return NEW_CHAT_TITLE;
  return truncateTitle(text);
}

export function formatSessionStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");
  if (!month || !day || !hour || !minute) return "";
  return `${month}-${day} ${hour}:${minute}`;
}

export function sessionOptionLabel(title: string, updatedAt: string): string {
  const stamp = formatSessionStamp(updatedAt);
  return stamp ? `${title} · ${stamp}` : title;
}

export function pickSessionAfterDelete<T extends { id: string }>(sessions: readonly T[], deletedId: string): T | null {
  return sessions.find((session) => session.id !== deletedId) ?? null;
}

export function chatSessionErrorStatus(message: string): number {
  if (message.includes("找不到")) return 404;
  if (
    message.includes("需要") ||
    message.includes("不正确") ||
    message.includes("太多") ||
    message.includes("最多") ||
    message.includes("太大") ||
    message.includes("太长") ||
    message.includes("缺少")
  ) {
    return 400;
  }
  return 500;
}
