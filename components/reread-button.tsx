"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

export function RereadButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setMessage("正在打开原文，补机会、福利、路径、门槛和联络人。");
    try {
      const response = await fetch("/api/opportunities/reread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 8 }),
      });
      const body = (await response.json()) as { updated?: number; error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "重新解读失败");
        return;
      }
      const updated = body.updated ?? 0;
      setMessage(updated > 0 ? `已按正文重写 ${updated} 条。` : "这次没有读到可以重写的正文。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={1} className="reread-action">
      <Button label={pending ? "正在重读" : "重新解读"} isDisabled={pending} onClick={() => void run()} />
      {message ? (
        <Text type="supporting" as="p">
          {message}
        </Text>
      ) : null}
    </VStack>
  );
}
