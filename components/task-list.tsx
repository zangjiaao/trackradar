"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { cadenceLabel } from "@/lib/collect";
import type { AgentTaskRow } from "@/lib/domain";

export function TaskList({ tasks }: { tasks: AgentTaskRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [action, setAction] = useState<"run" | "toggle" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  async function toggle(task: AgentTaskRow, value: boolean) {
    const previous = enabled[task.id] ?? task.enabled === 1;
    setEnabled((current) => ({ ...current, [task.id]: value }));
    setPendingId(task.id);
    setAction("toggle");
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id, enabled: value }),
      });
      if (!response.ok) setEnabled((current) => ({ ...current, [task.id]: previous }));
      else router.refresh();
    } catch {
      setEnabled((current) => ({ ...current, [task.id]: previous }));
      setMessage("网络请求失败，请重试。");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function run(task: AgentTaskRow) {
    setPendingId(task.id);
    setAction("run");
    setMessage(`正在执行「${task.name}」。`);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, trigger: "manual" }),
      });
      const body = (await response.json()) as { summary?: string; error?: string };
      setMessage(response.ok ? (body.summary ?? "执行完成。") : (body.error ?? "执行失败"));
      router.refresh();
    } catch {
      setMessage("网络请求失败，请重试。");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function remove(task: AgentTaskRow) {
    setPendingId(task.id);
    setAction("delete");
    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      router.refresh();
    } catch {
      setMessage("网络请求失败，请重试。");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <Text type="supporting" as="p">
        还没有采集任务。点击「添加任务」，选择定时或仅手动执行。
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
                {task.task_type === "opc" ? "OPC圈产品与需求" : "政策信源"} · {cadenceLabel(task.cadence)} · 回看 {task.lookback_days} 天
              </Text>
              <Text type="supporting">{task.instruction}</Text>
            </VStack>
            {task.cadence !== "manual" ? <Switch label="自动执行" value={enabled[task.id] ?? task.enabled === 1} isDisabled={pendingId !== null} onChange={(value) => void toggle(task, value)} /> : null}
          </HStack>
          <HStack gap={2} wrap="wrap">
            <Button label={pendingId === task.id && action === "run" ? "执行中" : "立即执行"} variant="secondary" isDisabled={pendingId !== null} onClick={() => void run(task)} />
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
