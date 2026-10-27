"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import type { PublicModelConfig } from "@/lib/settings";

export function ModelForm({ initial }: { initial: PublicModelConfig }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(initial.baseURL);
  const [model, setModel] = useState(initial.model);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(clearKey = false) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, clearKey, baseURL, model }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "保存失败");
        return;
      }
      setApiKey("");
      setMessage(clearKey ? "已改回环境变量。若 .dev.vars 里没有密钥，对话会停用。" : "模型配置已保存。对话会使用这份设置。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Text type="supporting" as="p">
        {initial.configured
          ? `${initial.keyHint}。模型 ${initial.model}${initial.baseURL ? `，网关 ${initial.baseURL}` : ""}。`
          : "还没有密钥。填在这里会写入本地数据库，不会回显完整密钥。"}
      </Text>
      {/* API Key 不是登录密码。这些属性尽量让 LastPass / 1Password 不要往输入框里插节点。 */}
      <TextInput
        label="API Key"
        type="password"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        value={apiKey}
        onChange={setApiKey}
        placeholder={initial.from === "settings" ? "留空则不修改" : "sk-…"}
        width="100%"
      />
      <TextInput
        label="Base URL"
        value={baseURL}
        onChange={setBaseURL}
        placeholder="可选，例如 https://api.openai.com/v1"
        width="100%"
      />
      <TextInput label="Model" value={model} onChange={setModel} placeholder="gpt-4o-mini" width="100%" />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "保存中" : "保存模型"} variant="primary" isDisabled={pending || model.trim().length === 0} onClick={() => void save(false)} />
        {initial.from === "settings" ? (
          <Button label="改回环境变量" variant="ghost" isDisabled={pending} onClick={() => void save(true)} />
        ) : null}
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
    </VStack>
  );
}
