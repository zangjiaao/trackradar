"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";

export function ScanSourcesButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setMessage("正在读取已启用信源的列表页。");
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays: 365, trigger: "chat" }),
      });
      const body = (await response.json()) as { summary?: string; error?: string; saved?: number };
      if (!response.ok) {
        setMessage(body.error ?? "回看失败");
        return;
      }
      setMessage(body.summary ?? `新写入 ${body.saved ?? 0} 条。`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <HStack gap={2} wrap="wrap" vAlign="center">
      <Button label={pending ? "回看中" : "回看已启用信源（约一年）"} variant="primary" isDisabled={pending} onClick={() => void run()} />
      <Link href="/tasks">执行记录</Link>
      <Link href="/">机会清单</Link>
      {message ? <Text type="supporting">{message}</Text> : null}
    </HStack>
  );
}
