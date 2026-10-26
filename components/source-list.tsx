"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { SourceActions } from "@/components/source-actions";
import type { SourceRow } from "@/lib/domain";

export function SourceList({ sources }: { sources: SourceRow[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sources.map((source) => [source.id, source.enabled === 1])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(id: string, value: boolean) {
    const previous = enabled[id];
    setEnabled((current) => ({ ...current, [id]: value }));
    setPendingId(id);
    try {
      const response = await fetch("/api/sources", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, enabled: value }),
      });
      if (!response.ok) {
        setEnabled((current) => ({ ...current, [id]: previous }));
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <VStack gap={3}>
      {sources.map((source) => (
        <Card key={source.id}>
          <VStack gap={2}>
            <HStack gap={3} justify="between" vAlign="start" wrap="wrap">
              <VStack gap={1}>
                <Text weight="medium">
                  {source.region} · {source.name}
                </Text>
                <Link href={source.list_url} target="_blank" rel="noreferrer noopener">
                  {source.list_url}
                </Link>
                {source.notes ? (
                  <Text type="supporting" as="p">
                    {source.notes}
                  </Text>
                ) : null}
              </VStack>
              <Switch
                label="启用"
                value={enabled[source.id] ?? false}
                isDisabled={pendingId === source.id}
                onChange={(value) => void toggle(source.id, value)}
              />
            </HStack>
            <SourceActions sourceId={source.id} />
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}
