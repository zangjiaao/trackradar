"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { List, ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
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
  summarizeWorkMessage,
  type WorkLogItem,
} from "@/lib/work-log-view";

function statusVariant(status: string): "success" | "error" | "warning" | "accent" | "neutral" {
  if (status === "done") return "success";
  if (status === "failed") return "error";
  if (status === "partial" || status === "skipped") return "warning";
  if (status === "running") return "accent";
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
          <Button label="清空已结束记录" variant="ghost" isDisabled={pending} onClick={() => setConfirming(true)} />
        ) : null}
      </HStack>
      {jobs.length === 0 ? (
        <Text type="supporting" as="p">
          还没有记录。添加定时任务，或对上面的任务点立即执行。
        </Text>
      ) : (
        <List density="spacious" edge="flush" hasDividers>
          {jobs.map((job) => {
            const view = summarizeWorkMessage(job);
            const kind = WORK_KIND_LABEL[job.kind] ?? job.kind;
            const status = WORK_STATUS_LABEL[job.status] ?? job.status;
            const where = [job.task_name, job.source_region && job.source_name ? `${job.source_region} · ${job.source_name}` : job.source_name]
              .filter((part): part is string => Boolean(part))
              .filter((part) => !view.title.includes(part.replace(" · ", "·")))
              .join(" · ");
            return (
              <ListItem
                key={job.id}
                align="start"
                label={
                  <HStack gap={3} wrap="wrap" vAlign="center" justify="between">
                    <HStack gap={2} wrap="wrap" vAlign="center">
                      <StatusDot variant={statusVariant(job.status)} label={status} />
                      <Text weight="medium">{status}</Text>
                      <Text weight="medium" wordBreak="break-word">{view.title}</Text>
                    </HStack>
                    <Text type="supporting" hasTabularNumbers>{formatWorkTime(job.created_at)}</Text>
                  </HStack>
                }
                description={
                  <VStack gap={2} paddingBlock={2}>
                    <Text type="supporting">{where ? `${kind} · ${where}` : kind}</Text>
                    {view.metrics.length > 0 ? (
                      <HStack gap={4} wrap="wrap">
                        {view.metrics.map((metric, index) => {
                          const count = metric.match(/^(.*?)\s*(\d+)(.*)$/);
                          return (
                            <HStack key={`${metric}-${index}`} gap={1} vAlign="center">
                              <Text type="supporting">{count?.[1]?.trim() || metric}</Text>
                              {count ? <Text weight="medium" hasTabularNumbers>{count[2]}{count[3]}</Text> : null}
                            </HStack>
                          );
                        })}
                      </HStack>
                    ) : null}
                    {view.notice ? <Text as="p" wordBreak="break-word">{view.notice}</Text> : null}
                    {view.details.length > 0 ? (
                      <Collapsible trigger={<Text type="supporting">查看执行详情</Text>} defaultIsOpen={false} chevronPosition="start">
                        <VStack gap={1}>
                          {view.details.map((note, index) => (
                            <Text key={`${index}-${note}`} as="p" type="supporting" wordBreak="break-word">{note}</Text>
                          ))}
                        </VStack>
                      </Collapsible>
                    ) : null}
                  </VStack>
                }
              />
            );
          })}
        </List>
      )}
      <Dialog isOpen={confirming} onOpenChange={setConfirming} purpose="info">
        <Layout
          header={
            <DialogHeader
              title="清空已结束记录"
              subtitle="执行中的记录会保留，定时任务也会保留。"
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
