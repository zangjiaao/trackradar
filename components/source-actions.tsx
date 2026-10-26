"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

type Preview = {
  items: { title: string; url: string; track_guess: string | null }[];
  error: string | null;
  saved: number;
};

export function SourceActions({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function run(save: boolean) {
    setPending(save ? "save" : "preview");
    try {
      const response = await fetch("/api/sources/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: sourceId, save }),
      });
      const body = (await response.json()) as Preview & { error?: string };
      if (!response.ok) {
        setPreview({ items: [], error: body.error ?? "抓取失败", saved: 0 });
        return;
      }
      setPreview({ items: body.items ?? [], error: body.error, saved: body.saved ?? 0 });
      if (save) router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Button
          label={pending === "preview" ? "抓取中" : "试抓"}
          size="sm"
          variant="secondary"
          isDisabled={pending !== null}
          onClick={() => void run(false)}
        />
        <Button
          label={pending === "save" ? "写入中" : "抓取并写入线索"}
          size="sm"
          variant="primary"
          isDisabled={pending !== null}
          onClick={() => void run(true)}
        />
      </HStack>
      {preview ? (
        <VStack gap={1}>
          <Text type="supporting" as="p">
            {preview.error ? `失败：${preview.error}` : `抽到 ${preview.items.length} 条${preview.saved ? `，新写入 ${preview.saved} 条` : ""}`}
          </Text>
          {preview.items.slice(0, 3).map((item) => (
            <Link key={item.url} href={item.url} target="_blank" rel="noreferrer noopener">
              {item.title}
            </Link>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
}
