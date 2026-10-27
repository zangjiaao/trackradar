"use client";

import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { CHAT_DRAFT_KEY, CHAT_MESSAGES_KEY, parseStoredMessages } from "@/lib/chat-memory";

const CHAT_ID = "trackradar-current";

let browserChat: Chat<UIMessage> | null = null;
let didRestore = false;
let writeTimer = 0;
let draftMemory = "";
let draftLoaded = false;
const draftListeners = new Set<() => void>();

function writeMessages(messages: UIMessage[]) {
  try {
    sessionStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // 配额满或隐私模式时，至少模块里的这一通对话还在。
  }
}

function flushMessages() {
  if (!didRestore || !browserChat) return;
  window.clearTimeout(writeTimer);
  writeTimer = 0;
  writeMessages(browserChat.messages);
}

function scheduleMessages() {
  if (!didRestore || !browserChat) return;
  window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(flushMessages, 200);
}

function loadDraft() {
  if (draftLoaded || typeof window === "undefined") return;
  draftLoaded = true;
  try {
    draftMemory = sessionStorage.getItem(CHAT_DRAFT_KEY) ?? "";
  } catch {
    draftMemory = "";
  }
}

export function getChatDraft(): string {
  loadDraft();
  return draftMemory;
}

export function getServerChatDraft(): string {
  return "";
}

export function subscribeChatDraft(onStoreChange: () => void) {
  draftListeners.add(onStoreChange);
  return () => {
    draftListeners.delete(onStoreChange);
  };
}

export function setChatDraft(value: string) {
  draftMemory = value;
  draftLoaded = true;
  try {
    sessionStorage.setItem(CHAT_DRAFT_KEY, value);
  } catch {
    // 同上，输入框仍跟着模块里的草稿。
  }
  for (const listener of draftListeners) listener();
}

export function getBrowserChat(): Chat<UIMessage> {
  if (!browserChat) {
    browserChat = new Chat<UIMessage>({ id: CHAT_ID, messages: [] });
    browserChat["~registerMessagesCallback"](() => scheduleMessages());
    browserChat["~registerStatusCallback"](() => {
      if (browserChat?.status === "ready" || browserChat?.status === "error") flushMessages();
    });
    window.addEventListener("pagehide", flushMessages);
  }
  return browserChat;
}

export function restoreBrowserChat(chat: Chat<UIMessage>) {
  if (chat !== browserChat || didRestore) return;
  const stored = parseStoredMessages(sessionStorage.getItem(CHAT_MESSAGES_KEY));
  didRestore = true;
  if (chat.messages.length === 0 && stored.length > 0) chat.messages = stored;
}
