"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { CollectConfig } from "@/lib/collect";

const OPTIONS = [
  { value: "daily", label: "每天 10:00（北京时间）" },
  { value: "weekly", label: "每周一 09:00（北京时间）" },
];

export function CollectForm({ initial }: { initial: CollectConfig }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cadence, setCadence] = useState(initial.cadence);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const unchanged = enabled === initial.enabled && cadence === initial.cadence;

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectEnabled: enabled, cadence }),
      });
      const body = (await response.json()) as { error?: string };
      setMessage(response.ok ? "采集周期已保存。到点仍只写任务记录，不会自动抓站。" : (body.error ?? "保存失败"));
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Switch label="启用定时采集" value={enabled} onChange={setEnabled} description="关闭后，Cron 触发只会记一条跳过。" />
      <Selector label="周期" value={cadence} options={OPTIONS} onChange={(value) => setCadence(value === "weekly" ? "weekly" : "daily")} />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "保存中" : "保存定时"} variant="primary" isDisabled={pending || unchanged} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
