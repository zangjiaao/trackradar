"use client";

import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatToolCalls,
  type ChatToolCallStatus,
} from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { FORMAT_SAMPLE, MessageMarkdown } from "@/components/message-markdown";
import { getBrowserChat, getChatDraft, getServerChatDraft, restoreBrowserChat, setChatDraft, subscribeChatDraft } from "@/components/chat-session";

const SUGGESTIONS = [
  "到已启用信源回看大约一年，把能映射到 T01–T10 的政策留下来，保留每条原始链接。",
  "对照已有政策和案例，说说我们现在做什么有助于发展。",
  "我在猪八戒看到一条知识库需求，请写入案例。标题是企业知识库 RAG 搭建，链接 https://example.com/kb-zbj ，站点猪八戒，地域杭州，笔记是有人求购、预算面议。",
];

type Status = { configured: boolean; model: string; baseURL: boolean };

function toolStatus(state?: string): ChatToolCallStatus {
  if (state === "output-available" || state === "result") return "complete";
  if (state === "output-error" || state === "error") return "error";
  if (state === "input-streaming" || state === "input-available") return "running";
  return "pending";
}

export function ChatPanel() {
  // 离开页面会卸载这里。Chat 实例留在模块里，同一标签页切回来仍是这一通，流式请求也不会被中止。
  const chat = useMemo(
    () => (typeof window === "undefined" ? new Chat<UIMessage>({ id: "trackradar-ssr", messages: [] }) : getBrowserChat()),
    [],
  );
  const { messages, sendMessage, status, error, stop } = useChat({ chat });
  const draft = useSyncExternalStore(subscribeChatDraft, getChatDraft, getServerChatDraft);
  const [restored, setRestored] = useState(messages.length > 0);
  const [config, setConfig] = useState<Status | null>(null);

  useEffect(() => {
    restoreBrowserChat(chat);
    setRestored(true);
  }, [chat]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((response) => response.json())
      .then((body: unknown) => {
        if (cancelled || !body || typeof body !== "object") return;
        const statusBody = body as Partial<Status>;
        setConfig({
          configured: Boolean(statusBody.configured),
          model: typeof statusBody.model === "string" ? statusBody.model : "gpt-4o-mini",
          baseURL: Boolean(statusBody.baseURL),
        });
      })
      .catch(() => {
        if (!cancelled) setConfig({ configured: false, model: "gpt-4o-mini", baseURL: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = status === "submitted" || status === "streaming";
  const blocked = config !== null && !config.configured;
  const lastMessage = messages.at(-1);

  function submit(text: string) {
    const value = text.trim();
    if (!value || blocked) return;
    setChatDraft("");
    void sendMessage({ text: value });
  }

  return (
    <ChatLayout
      data-chat-messages=""
      density="compact"
      composer={
        <ChatComposer
          data-chat-composer=""
          value={draft}
          onChange={setChatDraft}
          onSubmit={submit}
          onStop={() => stop()}
          isStopShown={busy}
          isDisabled={blocked}
          placeholder="对照政策和案例往下问"
          footerActions={
            <HStack gap={2} wrap="wrap">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  label={`${suggestion.slice(0, 18)}…`}
                  size="sm"
                  variant="ghost"
                  isDisabled={busy || blocked}
                  onClick={() => submit(suggestion)}
                />
              ))}
            </HStack>
          }
        />
      }
    >
      <ChatMessageList align={messages.length === 0 ? "top" : "bottom"} isStreaming={status === "streaming"} gap={3}>
        {blocked ? (
          <Banner
            status="error"
            title="还没有模型密钥"
            description="请用右上角「配置」填写 API Key、Base URL 和模型名。也可以把 OPENAI_API_KEY 写在 .dev.vars。没有密钥时不会发起模型请求。"
          />
        ) : (
          <Text type="supporting" as="p">
            模型 {config?.model ?? "读取中"}
            {config?.baseURL ? " · 使用自定义 Base URL" : ""}。回答会带上配置、最近政策和最近案例。也可以让助手把一条市场素材写入案例。
          </Text>
        )}
        {messages.length === 0 ? (
          restored ? (
          <ChatMessage sender="assistant" name="排版示例">
            <ChatMessageBubble variant="ghost" width="100%">
              <MessageMarkdown text={FORMAT_SAMPLE} streaming={false} />
            </ChatMessageBubble>
            <Text type="supporting" as="p">
              从下面的问题开始，或自己写一句。助手会把结论限制在 T01–T10。
            </Text>
          </ChatMessage>
          ) : null
        ) : (
          messages.map((message) => {
            const sender = message.role === "user" ? "user" : "assistant";
            const tools = message.parts.flatMap((part) => {
              if (!part.type.startsWith("tool-")) return [];
              const toolPart = part as { type: string; state?: string };
              return [{ name: part.type.slice("tool-".length), status: toolStatus(toolPart.state) }];
            });
            return (
              <ChatMessage key={message.id} sender={sender} name={sender === "user" ? "你" : "助手"}>
                {message.parts.map((part, index) => {
                  if (part.type !== "text") return null;
                  const streaming =
                    status === "streaming" &&
                    message.id === lastMessage?.id &&
                    sender === "assistant" &&
                    index === message.parts.length - 1;
                  return (
                    <ChatMessageBubble key={`${message.id}-${index}`} variant={sender === "assistant" ? "ghost" : "filled"} width="100%">
                      <MessageMarkdown text={part.text ?? ""} streaming={streaming} />
                    </ChatMessageBubble>
                  );
                })}
                {tools.length > 0 ? <ChatToolCalls calls={tools} /> : null}
              </ChatMessage>
            );
          })
        )}
        {error ? (
          <Text type="supporting" as="p">
            {error.message}
          </Text>
        ) : null}
      </ChatMessageList>
    </ChatLayout>
  );
}
