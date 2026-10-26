"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { cadenceLabel, type Cadence } from "@/lib/collect";
import type { AgentTaskRow } from "@/lib/domain";

export function TaskList({ tasks }: { tasks: AgentTaskRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(tasks.map((task) => [task.id, task.enabled === 1])));

  async function toggle(task: AgentTaskRow, value: boolean) {
    const previous = enabled[task.id];
    setEnabled((current) => ({ ...current, [task.id]: value }));
    setPendingId(task.id);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id, enabled: value }),
      });
      if (!response.ok) setEnabled((current) => ({ ...current, [task.id]: previous }));
      else router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function run(task: AgentTaskRow) {
    setPendingId(task.id);
    setMessage(`正在执行「${task.name}」。`);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, trigger: "manual" }),
      });
      const body = (await response.json()) as { summary?: string; error?: string };
      setMessage(response.ok ? (body.summary ?? "执行完成。") : (body.error ?? "执行失败"));
      if (response.ok) router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(task: AgentTaskRow) {
    setPendingId(task.id);
    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      if (response.ok) router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <Text type="supporting" as="p">
        还没有定时任务。添加后，每天 10:00 或每周一 09:00（北京时间）会自动回看。
      </Text>
    );
  }

  return (
    <VStack gap={3}>
      {tasks.map((task) => (
        <VStack key={task.id} gap={2}>
          <HStack gap={2} wrap="wrap" vAlign="center" justify="between">
            <VStack gap={1}>
              <Text weight="medium">{task.name}</Text>
              <Text type="supporting">
                {cadenceLabel(task.cadence as Cadence)} · 回看 {task.lookback_days} 天
              </Text>
              <Text type="supporting">{task.instruction}</Text>
            </VStack>
            <Switch label="启用" value={Boolean(enabled[task.id])} isDisabled={pendingId === task.id} onChange={(value) => void toggle(task, value)} />
          </HStack>
          <HStack gap={2} wrap="wrap">
            <Button label={pendingId === task.id ? "执行中" : "立即执行"} variant="secondary" isDisabled={pendingId !== null} onClick={() => void run(task)} />
            <Button label="删除" variant="ghost" isDisabled={pendingId !== null} onClick={() => void remove(task)} />
          </HStack>
        </VStack>
      ))}
      {message ? (
        <Text type="supporting" as="p">
          {message}
        </Text>
      ) : null}
    </VStack>
  );
}
