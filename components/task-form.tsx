"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import type { Cadence } from "@/lib/collect";
import { DEFAULT_INSTRUCTION } from "@/lib/task-input";

const OPTIONS = [
  { value: "daily", label: "每天 10:00（北京时间）" },
  { value: "weekly", label: "每周一 09:00（北京时间）" },
];

export function TaskForm() {
  const router = useRouter();
  const [name, setName] = useState("每日回看信源");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [lookback, setLookback] = useState("365");
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, cadence, lookbackDays: Number(lookback), instruction, enabled: true }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "添加失败");
        return;
      }
      setMessage("任务已添加。到点会采集正文。有模型时判断并写解读，没有密钥时不写入政策页。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <TextInput label="名称" value={name} onChange={setName} width="100%" />
      <HStack gap={3} wrap="wrap">
        <Selector label="周期" value={cadence} options={OPTIONS} onChange={(value) => setCadence(value === "weekly" ? "weekly" : "daily")} />
        <TextInput label="回看天数" value={lookback} onChange={setLookback} placeholder="365" />
      </HStack>
      <TextArea label="要找什么" rows={3} value={instruction} width="100%" onChange={setInstruction} />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "添加中" : "添加任务"} variant="primary" isDisabled={pending || name.trim().length < 2} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
