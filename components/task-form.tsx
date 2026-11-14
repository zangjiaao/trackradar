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
import type { TaskCadence } from "@/lib/collect";
import { DEFAULT_INSTRUCTION, OPC_INSTRUCTION } from "@/lib/task-input";

const OPTIONS = [
  { value: "manual", label: "仅手动执行" },
  { value: "daily", label: "每天 10:00（北京时间）" },
  { value: "weekly", label: "每周一 09:00（北京时间）" },
];

export function TaskForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("手动采集 OPC 案例");
  const [cadence, setCadence] = useState<TaskCadence>("manual");
  const [lookback, setLookback] = useState("30");
  const [instruction, setInstruction] = useState(OPC_INSTRUCTION);
  const [taskType, setTaskType] = useState<"policy" | "opc">("opc");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, taskType, cadence, lookbackDays: Number(lookback), instruction, enabled: true }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "添加失败");
        return;
      }
      router.refresh();
      onSaved();
    } catch {
      setMessage("网络请求失败，请重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Selector label="采集目标" value={taskType} width="100%" options={[
        { value: "opc", label: "OPC圈产品与需求" },
        { value: "policy", label: "已配置信源的政策" },
      ]} onChange={(value) => {
        const target = value === "policy" ? "policy" : "opc";
        setTaskType(target);
        setName(target === "opc" ? "采集 OPC 案例" : "回看政策信源");
        setLookback(target === "opc" ? "30" : "365");
        setInstruction(target === "opc" ? OPC_INSTRUCTION : DEFAULT_INSTRUCTION);
      }} />
      <TextInput label="名称" value={name} onChange={setName} width="100%" />
      <HStack gap={3} wrap="wrap">
        <Selector label="周期" value={cadence} options={OPTIONS} onChange={(value) => setCadence(value === "weekly" ? "weekly" : value === "manual" ? "manual" : "daily")} />
        <TextInput label="回看天数" value={lookback} onChange={setLookback} placeholder={taskType === "opc" ? "30" : "365"} />
      </HStack>
      <Text type="supporting">{taskType === "opc" ? "采集产品和需求，按原链接去重。有模型时按现有赛道筛选，无模型时保留候选待处理。" : "访问配置中已启用的政策信源，采集正文和 PDF 附件，筛选后写入政策页。"}</Text>
      <TextArea label="要找什么" rows={3} value={instruction} width="100%" onChange={setInstruction} />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "添加中" : "添加任务"} variant="primary" isDisabled={pending || name.trim().length < 2} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
