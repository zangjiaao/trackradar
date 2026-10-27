"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";

export function MaterialSitesForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ materialSites: text }),
      });
      const body = (await response.json()) as { error?: string };
      setMessage(response.ok ? "站点说明已保存。对话会读到这段文字，仍不会去爬这些网站。" : (body.error ?? "保存失败"));
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <TextArea label="常用站点" rows={4} value={text} width="100%" onChange={setText} />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "保存中" : "保存站点说明"} variant="primary" isDisabled={pending || text.trim().length < 4 || text === initial} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
