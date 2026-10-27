"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";

export type PublicTavilyConfig = {
  configured: boolean;
  from: "settings" | "env" | null;
  keyHint: string | null;
};

export function TavilyKeyForm({ initial }: { initial: PublicTavilyConfig }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(clearKey = false) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tavilyApiKey: apiKey, clearTavilyKey: clearKey }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "保存失败");
        return;
      }
      setApiKey("");
      setMessage(clearKey ? "已改回环境变量。若 .dev.vars 里没有 TAVILY_API_KEY，联网搜索不可用。" : "Tavily 密钥已保存。对话可以联网搜索。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Text type="supporting" as="p">
        {initial.configured ? `${initial.keyHint}。` : "还没有 Tavily 密钥。未配置时，对话里的联网搜索会提示来这里填写。"}
        在{" "}
        <Link href="https://app.tavily.com" isExternalLink newTabLabel="（新标签打开）">
          Tavily 控制台
        </Link>{" "}
        注册并复制 API Key。也可以写在 .dev.vars 的 TAVILY_API_KEY。配置页保存的优先，接口不回显全文。
      </Text>
      <TextInput
        label="Tavily API Key"
        type="password"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        value={apiKey}
        onChange={setApiKey}
        placeholder={initial.from === "settings" ? "留空则不修改" : "tvly-…"}
        width="100%"
      />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "保存中" : "保存搜索密钥"} variant="primary" isDisabled={pending || apiKey.trim().length === 0} onClick={() => void save(false)} />
        {initial.from === "settings" ? (
          <Button label="改回环境变量" variant="ghost" isDisabled={pending} onClick={() => void save(true)} />
        ) : null}
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
