"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FORMAT_SAMPLE, MessageMarkdown } from "@/components/message-markdown";

const SUGGESTIONS = [
  "按默认权重说明 T01–T10 里工作室最该先做哪三条，并给出 demo 切口。",
  "列出已入库线索，保留每条原始链接，并映射到赛道。",
  "查看上海和北京的政策信源，并试抓列表，不要假设已经全站爬取。",
];

type Status = { configured: boolean; model: string; baseURL: boolean };

function toolLabel(part: { type: string; state?: string }): string | null {
  if (!part.type.startsWith("tool-")) return null;
  const name = part.type.slice("tool-".length);
  return `调用 ${name}${part.state ? ` · ${part.state}` : ""}`;
}

export function ChatPanel() {
  const { messages, sendMessage, status, error, stop } = useChat();
  const [draft, setDraft] = useState("");
  const [config, setConfig] = useState<Status | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

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

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || messages.length === 0 || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const blocked = config !== null && !config.configured;
  const lastMessage = messages.at(-1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {blocked ? (
        <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6">
          还没有模型密钥，对话不会发出。请在 <code>.dev.vars</code> 设置 <code>OPENAI_API_KEY</code>
          ，可选 <code>OPENAI_BASE_URL</code> 与 <code>OPENAI_MODEL</code>（默认 gpt-4o-mini），保存后重启{" "}
          <code>npm run dev</code>。
        </div>
      ) : (
        <p className="shrink-0 text-xs text-muted-foreground">
          模型 {config?.model ?? "读取中"}
          {config?.baseURL ? " · 使用自定义 OPENAI_BASE_URL" : ""}。流式输出，可调用赛道、线索和信源工具。
        </p>
      )}

      <div
        ref={scrollerRef}
        data-chat-messages
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
        }}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        {messages.length === 0 ? (
          <div className="mr-8">
            <p className="mb-1 text-xs text-muted-foreground">排版示例</p>
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
              <MessageMarkdown text={FORMAT_SAMPLE} streaming={false} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">从下面的问题开始，或自己写一句。助手会把结论限制在 T01–T10。</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "ml-8" : "mr-8"}>
              <p className="mb-1 text-xs text-muted-foreground">{message.role === "user" ? "你" : "助手"}</p>
              <div className="space-y-2 rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
                {message.parts.map((part, index) => {
                  const streaming =
                    status === "streaming" &&
                    message.id === lastMessage?.id &&
                    message.role === "assistant" &&
                    index === message.parts.length - 1 &&
                    part.type === "text";
                  if (part.type === "text") {
                    return <MessageMarkdown key={`${message.id}-${index}`} text={part.text ?? ""} streaming={streaming} />;
                  }
                  const label = toolLabel(part as { type: string; state?: string });
                  if (!label) return null;
                  return (
                    <p key={`${message.id}-${index}`} className="text-xs text-muted-foreground">
                      {label}
                    </p>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            disabled={busy || blocked}
            onClick={() => {
              stickToBottomRef.current = true;
              void sendMessage({ text: suggestion });
            }}
          >
            {suggestion.slice(0, 18)}…
          </Button>
        ))}
      </div>

      <form
        data-chat-composer
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text || blocked) return;
          stickToBottomRef.current = true;
          setDraft("");
          void sendMessage({ text });
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="问赛道、线索或本周该做什么 demo"
          rows={3}
          disabled={blocked}
          className="field-sizing-fixed max-h-32 min-h-16 resize-none overflow-y-auto"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || blocked || draft.trim().length === 0}>
            发送
          </Button>
          {busy ? (
            <Button type="button" variant="outline" onClick={() => stop()}>
              停止
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
