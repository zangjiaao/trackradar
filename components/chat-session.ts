"use client";

import { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  CHAT_ACTIVE_KEY,
  CHAT_DRAFT_KEY,
  CHAT_MESSAGES_KEY,
  parseStoredMessages,
  pickSessionAfterDelete,
  sessionTitleFromMessages,
  type ChatSessionDetail,
  type ChatSessionSummary,
} from "@/lib/chat-memory";

export type ChatBrowserSnapshot = {
  ready: boolean;
  pending: boolean;
  offline: boolean;
  sessions: ChatSessionSummary[];
  activeId: string | null;
  draft: string;
  error: string | null;
  chat: Chat<UIMessage>;
};

type SessionRecord = {
  id: string;
  title: string;
  draft: string;
  createdAt: string;
  updatedAt: string;
  persist: boolean;
  deleted: boolean;
  timer: number;
  chat: Chat<UIMessage>;
};

type ListResponse = { sessions: ChatSessionSummary[] };
type SessionResponse = { session: ChatSessionDetail };

const records = new Map<string, SessionRecord>();
const tails = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function createInitialSnapshot(): ChatBrowserSnapshot {
  return {
    ready: false,
    pending: false,
    offline: false,
    sessions: [],
    activeId: null,
    draft: "",
    error: null,
    chat: new Chat<UIMessage>({ id: "trackradar-pending", messages: [] }),
  };
}

const serverSnapshot = createInitialSnapshot();
let snapshot: ChatBrowserSnapshot = serverSnapshot;
let bootstrapped = false;
let actionQueue: Promise<void> = Promise.resolve();

function emit() {
  for (const listener of listeners) listener();
}

function sortSessions(sessions: ChatSessionSummary[]): ChatSessionSummary[] {
  return [...sessions].sort((left, right) => right.updated_at.localeCompare(left.updated_at) || right.created_at.localeCompare(left.created_at));
}

function toSummary(session: ChatSessionDetail): ChatSessionSummary {
  return { id: session.id, title: session.title, created_at: session.created_at, updated_at: session.updated_at };
}

function summaryFromRecord(record: SessionRecord): ChatSessionSummary {
  return { id: record.id, title: record.title, created_at: record.createdAt, updated_at: record.updatedAt };
}

export function subscribeChatSessions(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getChatSnapshot(): ChatBrowserSnapshot {
  return snapshot;
}

export function getServerChatSnapshot(): ChatBrowserSnapshot {
  return serverSnapshot;
}

function rememberActive(id: string) {
  try {
    localStorage.setItem(CHAT_ACTIVE_KEY, id);
  } catch {
    // 隐私模式下列表仍可切换，只是刷新后不一定回到这一条。
  }
}

function readActive(): string | null {
  try {
    return localStorage.getItem(CHAT_ACTIVE_KEY);
  } catch {
    return null;
  }
}

function readLegacy(): { messages: UIMessage[]; draft: string } | null {
  try {
    const messages = parseStoredMessages(sessionStorage.getItem(CHAT_MESSAGES_KEY));
    const draft = sessionStorage.getItem(CHAT_DRAFT_KEY) ?? "";
    if (messages.length === 0 && draft.trim() === "") return null;
    return { messages, draft };
  } catch {
    return null;
  }
}

function clearLegacy() {
  try {
    sessionStorage.removeItem(CHAT_MESSAGES_KEY);
    sessionStorage.removeItem(CHAT_DRAFT_KEY);
  } catch {
    // 清不掉就下次再试着导入。
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as { error?: unknown } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return body as T;
}

function show(record: SessionRecord, sessions: ChatSessionSummary[], error: string | null = snapshot.error) {
  snapshot = {
    ...snapshot,
    ready: true,
    sessions: sortSessions(sessions),
    activeId: record.id,
    draft: record.draft,
    chat: record.chat,
    error,
  };
  if (record.persist) rememberActive(record.id);
  emit();
}

function bindChat(record: SessionRecord) {
  record.chat["~registerMessagesCallback"](() => {
    if (record.deleted || !record.persist) return;
    const title = sessionTitleFromMessages(record.chat.messages);
    if (title !== record.title) {
      record.title = title;
      if (snapshot.sessions.some((session) => session.id === record.id && session.title !== title)) {
        snapshot = {
          ...snapshot,
          sessions: snapshot.sessions.map((session) => (session.id === record.id ? { ...session, title } : session)),
        };
        emit();
      }
    }
    scheduleFlush(record.id);
  });
  record.chat["~registerStatusCallback"](() => {
    if (record.deleted || !record.persist) return;
    if (record.chat.status === "ready" || record.chat.status === "error") void flushSession(record.id);
  });
}

function createRecord(detail: ChatSessionDetail, persist: boolean): SessionRecord {
  const chat = new Chat<UIMessage>({ id: detail.id, messages: detail.messages });
  const record: SessionRecord = {
    id: detail.id,
    title: detail.title || sessionTitleFromMessages(detail.messages),
    draft: detail.draft,
    createdAt: detail.created_at,
    updatedAt: detail.updated_at,
    persist,
    deleted: false,
    timer: 0,
    chat,
  };
  bindChat(record);
  records.set(record.id, record);
  return record;
}

function createMemoryRecord(messages: UIMessage[] = [], draft = ""): SessionRecord {
  const now = new Date().toISOString();
  return createRecord(
    {
      id: crypto.randomUUID(),
      title: sessionTitleFromMessages(messages),
      draft,
      created_at: now,
      updated_at: now,
      messages,
    },
    false,
  );
}

function applySaved(session: ChatSessionDetail) {
  const record = records.get(session.id);
  if (!record || record.deleted) return;
  record.title = session.title;
  record.updatedAt = session.updated_at;
  const next = sortSessions(
    snapshot.sessions.map((item) =>
      item.id === session.id
        ? { id: session.id, title: session.title, created_at: session.created_at, updated_at: session.updated_at }
        : item,
    ),
  );
  const unchanged = next.every((item, index) => {
    const current = snapshot.sessions[index];
    return current?.id === item.id && current.title === item.title && current.updated_at === item.updated_at;
  });
  if (unchanged) return;
  snapshot = { ...snapshot, sessions: next };
  emit();
}

function enqueue(id: string, job: () => Promise<void>) {
  const prev = tails.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(job);
  tails.set(id, next);
  return next;
}

function scheduleFlush(id: string) {
  const record = records.get(id);
  if (!record || record.deleted || !record.persist) return;
  window.clearTimeout(record.timer);
  record.timer = window.setTimeout(() => {
    void flushSession(id);
  }, 400);
}

async function flushSession(id: string) {
  const record = records.get(id);
  if (!record || record.deleted || !record.persist) return;
  window.clearTimeout(record.timer);
  record.timer = 0;
  let messages: UIMessage[];
  try {
    messages = JSON.parse(JSON.stringify(record.chat.messages)) as UIMessage[];
  } catch {
    messages = record.chat.messages;
  }
  const draft = record.draft;
  try {
    await enqueue(id, async () => {
      if (record.deleted) return;
      const saved = await requestJson<SessionResponse>(`/api/chat/sessions/${record.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, draft }),
      });
      applySaved(saved.session);
    });
  } catch (error) {
    snapshot = { ...snapshot, error: error instanceof Error ? error.message : "会话没能保存" };
    emit();
  }
}

function flushKeepalive(id: string) {
  const record = records.get(id);
  if (!record || record.deleted || !record.persist) return;
  window.clearTimeout(record.timer);
  record.timer = 0;
  const body = JSON.stringify({ messages: record.chat.messages, draft: record.draft });
  void fetch(`/api/chat/sessions/${record.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
    keepalive: body.length < 60_000,
  }).catch(() => undefined);
}

async function openServerSession(id: string, sessions: ChatSessionSummary[]) {
  const cached = records.get(id);
  if (cached && !cached.deleted) {
    show(cached, sessions, null);
    return;
  }
  const detail = await requestJson<SessionResponse>(`/api/chat/sessions/${id}`);
  const record = createRecord(detail.session, true);
  show(record, sessions, null);
}

async function createOnServer(input: { messages?: UIMessage[]; draft?: string } = {}): Promise<SessionRecord> {
  const saved = await requestJson<SessionResponse>("/api/chat/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return createRecord(saved.session, true);
}

function runAction(task: () => Promise<void>) {
  const run = actionQueue.catch(() => undefined).then(async () => {
    if (!snapshot.ready) return;
    snapshot = { ...snapshot, pending: true };
    emit();
    try {
      await task();
    } catch (error) {
      snapshot = { ...snapshot, error: error instanceof Error ? error.message : "会话操作失败" };
      emit();
    } finally {
      snapshot = { ...snapshot, pending: false };
      emit();
    }
  });
  actionQueue = run;
  return run;
}

export function ensureChatSessions() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  window.addEventListener("pagehide", () => {
    for (const id of records.keys()) flushKeepalive(id);
  });
  void bootstrap();
}

function offlineMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "读取会话失败";
  return `数据库暂时不可用，这个会话只留在当前页面。${message}`;
}

function showOffline(messages: UIMessage[], draft: string, error: unknown) {
  const record = createMemoryRecord(messages, draft);
  snapshot = { ...snapshot, offline: true };
  show(record, [summaryFromRecord(record)], offlineMessage(error));
}

async function bootstrap() {
  let sessions: ChatSessionSummary[];
  try {
    sessions = (await requestJson<ListResponse>("/api/chat/sessions")).sessions;
  } catch (error) {
    const legacy = readLegacy();
    showOffline(legacy?.messages ?? [], legacy?.draft ?? "", error);
    return;
  }

  const legacy = readLegacy();
  if (legacy) {
    try {
      const record = await createOnServer(legacy);
      clearLegacy();
      show(record, [summaryFromRecord(record), ...sessions.filter((session) => session.id !== record.id)], null);
      return;
    } catch (error) {
      if (sessions.length === 0) {
        showOffline(legacy.messages, legacy.draft, error);
        return;
      }
      snapshot = { ...snapshot, error: error instanceof Error ? error.message : "旧对话没能导入" };
    }
  }

  if (sessions.length === 0) {
    try {
      const record = await createOnServer();
      show(record, [summaryFromRecord(record)], null);
    } catch (error) {
      showOffline([], "", error);
    }
    return;
  }

  const savedId = readActive();
  const chosen = sessions.find((session) => session.id === savedId) ?? sessions[0];
  if (!chosen) return;
  try {
    await openServerSession(chosen.id, sessions);
  } catch (error) {
    const record = createMemoryRecord();
    show(record, [summaryFromRecord(record), ...sessions], error instanceof Error ? error.message : "没能打开会话");
  }
}

export function setChatDraft(value: string) {
  const id = snapshot.activeId;
  if (!id) return;
  const record = records.get(id);
  if (!record || record.deleted) return;
  record.draft = value;
  snapshot = { ...snapshot, draft: value };
  emit();
  scheduleFlush(id);
}

export function createChatSession() {
  return runAction(async () => {
    const current = snapshot.activeId;
    if (current) await flushSession(current);
    if (snapshot.offline) {
      const record = createMemoryRecord();
      show(record, [summaryFromRecord(record), ...snapshot.sessions], null);
      return;
    }
    const record = await createOnServer();
    show(record, [summaryFromRecord(record), ...snapshot.sessions], null);
  });
}

export function switchChatSession(id: string) {
  return runAction(async () => {
    if (!id || id === snapshot.activeId) return;
    const current = snapshot.activeId;
    if (current) await flushSession(current);
    const cached = records.get(id);
    if (cached && !cached.deleted) {
      show(cached, snapshot.sessions, null);
      return;
    }
    await openServerSession(id, snapshot.sessions);
  });
}

export function deleteActiveChatSession() {
  return runAction(async () => {
    const id = snapshot.activeId;
    if (!id) return;
    const record = records.get(id);
    if (!record) return;
    if (record.chat.status === "streaming" || record.chat.status === "submitted") {
      await record.chat.stop();
    }
    record.deleted = true;
    window.clearTimeout(record.timer);
    record.timer = 0;
    const tail = tails.get(id) ?? Promise.resolve();
    await tail.catch(() => undefined);
    try {
      if (record.persist) {
        await requestJson<{ ok: boolean }>(`/api/chat/sessions/${id}`, { method: "DELETE" });
      }
    } catch (error) {
      record.deleted = false;
      throw error;
    }
    records.delete(id);
    const rest = snapshot.sessions.filter((session) => session.id !== id);
    const next = pickSessionAfterDelete(snapshot.sessions, id);
    if (!next) {
      if (snapshot.offline) {
        const memory = createMemoryRecord();
        show(memory, [summaryFromRecord(memory)], null);
        return;
      }
      const created = await createOnServer();
      show(created, [summaryFromRecord(created)], null);
      return;
    }
    try {
      await openServerSession(next.id, rest);
    } catch (error) {
      const memory = createMemoryRecord();
      const message = error instanceof Error ? error.message : "没能打开下一个会话";
      show(memory, [summaryFromRecord(memory), ...rest], message);
    }
  });
}
