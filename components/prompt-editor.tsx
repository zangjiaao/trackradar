"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptEditor({ initial, version }: { initial: string; version: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          const response = await fetch("/api/prompts", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ system_prompt: text }),
          });
          const body = (await response.json()) as { error?: string };
          setMessage(response.ok ? `已更新当前激活版本 ${version}。` : (body.error ?? "保存失败"));
          if (response.ok) router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <Textarea rows={12} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || text.trim() === initial.trim()}>
          保存提示词
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
