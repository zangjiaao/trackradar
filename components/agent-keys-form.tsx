"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import type { AgentKeyPublic } from "@/lib/agent-key";

export function AgentKeysForm({ keys }: { keys: AgentKeyPublic[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    setMessage(null);
    setCreated(null);
    try {
      const response = await fetch("/api/agent-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await response.json()) as { error?: string; key?: string };
      if (!response.ok || !body.key) {
        setMessage(body.error ?? "没建成钥匙。");
        return;
      }
      setName("");
      setCreated(body.key);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/agent-keys", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "没作废。");
        return;
      }
      setMessage("已作废。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Text type="supporting" as="p">
        给办公室 Agent 一把只读钥匙。全文只在创建时出现一次。写到办公室机器的 ~/.config/trackradar/agent.key，权限 600。不要发到对话里。
      </Text>
      {created ? (
        <Text type="supporting" as="p">
          {created}
        </Text>
      ) : null}
      <TextInput label="名称" value={name} onChange={setName} placeholder="办公室" width="100%" />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "创建中" : "创建钥匙"} variant="primary" isDisabled={pending} onClick={() => void create()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
      {keys.length === 0 ? (
        <Text type="supporting" as="p">
          还没有钥匙。
        </Text>
      ) : (
        keys.map((key) => (
          <HStack key={key.id} gap={2} wrap="wrap" vAlign="center">
            <Text>
              {key.name} · {key.prefix}
            </Text>
            <Button label="作废" variant="ghost" isDisabled={pending} onClick={() => void revoke(key.id)} />
          </HStack>
        ))
      )}
    </VStack>
  );
}
