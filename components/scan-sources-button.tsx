"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

export function ScanSourcesButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setMessage("正在从已启用信源拉取近一年政策。");
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays: 365, trigger: "chat" }),
      });
      const body = (await response.json()) as { summary?: string; error?: string; saved?: number };
      if (!response.ok) {
        setMessage(body.error ?? "拉取失败");
        return;
      }
      const saved = body.saved ?? 0;
      setMessage(saved > 0 ? `已写入 ${saved} 条。过程记在任务页的执行记录里。` : "这次没有新的合格条目。过程记在任务页的执行记录里。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={1}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "正在拉取" : "从信源拉取近一年政策"} variant="primary" isDisabled={pending} onClick={() => void run()} />
        <Link href="/tasks">执行记录</Link>
        <Link href="/">政策</Link>
      </HStack>
      <Text type="supporting" as="p">
        先采集标题、时间和正文入库，再评分。低分不进政策页，只解读留下的。这些政策会留给对话确定方向。
      </Text>
      {message ? (
        <Text type="supporting" as="p">
          {message}
        </Text>
      ) : null}
    </VStack>
  );
}
