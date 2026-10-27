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
    setMessage("正在请模型读正文，重写解读。");
    try {
      const response = await fetch("/api/opportunities/reread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 8 }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "重新解读失败");
        return;
      }
      setMessage(body.message ?? "重新解读结束。");
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
