"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "按默认权重说明 T01–T10 里工作室最该先做哪三条，并给出 demo 切口。",
  "列出已入库线索，保留每条原始链接，并映射到赛道。",
  "查看上海和北京的政策信源，并试抓列表，不要假设已经全站爬取。",
];

type Status = { configured: boolean; model: string; baseURL: boolean };

function partText(part: { type: string; text?: string; state?: string }): string | null {
  if (part.type === "text") return part.text ?? "";
  if (part.type.startsWith("tool-")) {
    const name = part.type.slice("tool-".length);
    return `调用 ${name}${part.state ? ` · ${part.state}` : ""}`;
  }
  return null;
}

export function ChatPanel() {
  const { messages, sendMessage, status, error, stop } = useChat();
  const [draft, setDraft] = useState("");
  const [config, setConfig] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((response) => response.json())
      .then((body: unknown) => {
        if (cancelled || !body || typeof body !== "object") return;
        const status = body as Partial<Status>;
        setConfig({
          configured: Boolean(status.configured),
          model: typeof status.model === "string" ? status.model : "gpt-4o-mini",
          baseURL: Boolean(status.baseURL),
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

  return (
    <div className="flex flex-col gap-4">
      {blocked ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6">
          还没有模型密钥，对话不会发出。请在 <code>.dev.vars</code> 设置 <code>OPENAI_API_KEY</code>
          ，可选 <code>OPENAI_BASE_URL</code> 与 <code>OPENAI_MODEL</code>（默认 gpt-4o-mini），保存后重启{" "}
          <code>npm run dev</code>。
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          模型 {config?.model ?? "读取中"}
          {config?.baseURL ? " · 使用自定义 OPENAI_BASE_URL" : ""}。流式输出，可调用赛道、线索和信源工具。
        </p>
      )}

      <div className="flex min-h-80 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">从下面的问题开始，或自己写一句。助手会把结论限制在 T01–T10。</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "ml-8" : "mr-8"}>
              <p className="mb-1 text-xs text-muted-foreground">{message.role === "user" ? "你" : "助手"}</p>
              <div className="space-y-2 rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
                {message.parts.map((part, index) => {
                  const text = partText(part as { type: string; text?: string; state?: string });
                  if (text === null) return null;
                  const tool = part.type.startsWith("tool-");
                  return (
                    <p key={`${message.id}-${index}`} className={tool ? "text-xs text-muted-foreground" : "whitespace-pre-wrap"}>
                      {text}
                    </p>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            disabled={busy || blocked}
            onClick={() => sendMessage({ text: suggestion })}
          >
            {suggestion.slice(0, 18)}…
          </Button>
        ))}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text || blocked) return;
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
