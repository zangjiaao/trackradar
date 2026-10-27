"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";

export function PromptEditor({ initial, version }: { initial: string; version: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
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
      <VStack gap={3}>
        <TextArea label="系统提示词" rows={12} value={text} onChange={(value) => setText(value)} width="100%" />
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label={pending ? "保存中" : "保存提示词"} type="submit" variant="primary" isDisabled={pending || text.trim() === initial.trim()} />
          {message ? <Text type="supporting">{message}</Text> : null}
        </HStack>
      </VStack>
    </form>
  );
}
