import type { UIMessage } from "ai";

export const CHAT_MESSAGES_KEY = "trackradar.chat.messages";
export const CHAT_DRAFT_KEY = "trackradar.chat.draft";

function isMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export function parseStoredMessages(raw: string | null): UIMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMessage);
  } catch {
    return [];
  }
}
