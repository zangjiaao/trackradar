"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  WORK_KIND_LABEL,
  WORK_STATUS_LABEL,
  formatWorkTime,
  presentWorkMessage,
  type WorkLogItem,
} from "@/lib/work-log-view";

function statusVariant(status: string): "success" | "error" | "warning" | "neutral" {
  if (status === "done") return "success";
  if (status === "failed") return "error";
  if (status === "skipped") return "warning";
  return "neutral";
}

export function WorkLog({ jobs }: { jobs: WorkLogItem[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clearLogs() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/work", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "清空失败，记录还在。");
        return;
      }
      setConfirming(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap" vAlign="center" justify="between">
        <Heading level={2}>执行记录</Heading>
        {jobs.length > 0 ? (
          <Button label="清空记录" variant="ghost" isDisabled={pending} onClick={() => setConfirming(true)} />
        ) : null}
      </HStack>
      {jobs.length === 0 ? (
        <Text type="supporting" as="p">
          还没有记录。可以在对话里回看信源，或对上面的任务点立即执行。
        </Text>
      ) : (
        <VStack gap={2}>
          {jobs.map((job) => {
            const view = presentWorkMessage(job.message);
            const kind = WORK_KIND_LABEL[job.kind] ?? job.kind;
            const where = [job.task_name, job.source_region && job.source_name ? `${job.source_region} · ${job.source_name}` : job.source_name]
              .filter((part): part is string => Boolean(part))
              .filter((part) => !view.title.includes(part.replace(" · ", "·")))
              .join(" · ");
            return (
              <Card key={job.id} padding={3}>
                <VStack gap={2}>
                  <HStack gap={2} wrap="wrap" vAlign="center" justify="between">
                    <HStack gap={2} wrap="wrap" vAlign="center">
                      <Text weight="medium">{view.title}</Text>
                      <Badge variant={statusVariant(job.status)} label={WORK_STATUS_LABEL[job.status] ?? job.status} />
                    </HStack>
                    <Text type="supporting">{formatWorkTime(job.created_at)}</Text>
                  </HStack>
                  <Text type="supporting">{where ? `${kind} · ${where}` : kind}</Text>
                  {view.chips.length > 0 ? (
                    <HStack gap={2} wrap="wrap">
                      {view.chips.map((chip, index) => (
                        <Text key={`${chip}-${index}`}>{chip}</Text>
                      ))}
                    </HStack>
                  ) : null}
                  {view.notes.map((note, index) => (
                    <Text key={`${note}-${index}`} as="p">
                      {note}
                    </Text>
                  ))}
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
      <Dialog isOpen={confirming} onOpenChange={setConfirming} purpose="info" width="min(28rem, calc(100vw - 2rem))">
        <Layout
          header={
            <DialogHeader
              title="清空执行记录"
              subtitle="只清掉这些日志。上面的定时任务还留着。"
              onOpenChange={setConfirming}
            />
          }
          content={
            <LayoutContent padding={4}>
              <VStack gap={3}>
                <Text as="p">清空后没法恢复。政策页和案例页不受影响。</Text>
                {error ? (
                  <Text as="p" type="supporting">
                    {error}
                  </Text>
                ) : null}
                <HStack gap={2} wrap="wrap">
                  <Button label="再想想" variant="secondary" isDisabled={pending} onClick={() => setConfirming(false)} />
                  <Button label={pending ? "正在清空" : "清空"} variant="destructive" isDisabled={pending} onClick={() => void clearLogs()} />
                </HStack>
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>
    </VStack>
  );
}
