"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { PLATFORM_LABEL, SIDE_LABEL, type ParsedSample, type Platform, type Side } from "@/lib/domain";

type Preview = ParsedSample & { platform: Platform; keyword: string; side: Side };

const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABEL).map(([value, label]) => ({ value, label }));
const SIDE_OPTIONS = Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }));

export function SampleImporter() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<Platform>("xianyu");
  const [side, setSide] = useState<Side>("demand");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<Preview[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function parse() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "parse", text, platform, side, keyword }),
      });
      const body = (await response.json()) as { items?: Preview[]; error?: string };
      if (!response.ok) {
        setItems([]);
        setMessage(body.error ?? "解析失败");
        return;
      }
      setItems(body.items ?? []);
      setMessage(`抽出 ${body.items?.length ?? 0} 条，确认后写入本地 D1。`);
    } finally {
      setPending(false);
    }
  }

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const body = (await response.json()) as { saved?: number; error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "保存失败");
        return;
      }
      setItems([]);
      setText("");
      setMessage(`已写入 ${body.saved ?? 0} 条采样。`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={4}>
      <Grid columns={{ minWidth: 220, max: 3 }} gap={3}>
        <Selector
          label="平台"
          value={platform}
          options={PLATFORM_OPTIONS}
          onChange={(value) => setPlatform(value as Platform)}
        />
        <Selector label="供需侧" value={side} options={SIDE_OPTIONS} onChange={(value) => setSide(value as Side)} />
        <TextInput label="关键词" value={keyword} onChange={(value) => setKeyword(value)} placeholder="例如 企业知识库" />
      </Grid>
      <TextArea
        label="搜索结果"
        rows={8}
        value={text}
        width="100%"
        onChange={(value) => setText(value)}
        placeholder={"粘贴搜索结果。支持：\n标题\nhttps://example.com/item\n¥1999\n\n或 [标题](https://example.com)"}
      />
      <HStack gap={2} wrap="wrap">
        <Button label="解析预览" variant="primary" isDisabled={pending || text.trim().length === 0} onClick={() => void parse()} />
        <Button label="写入采样表" variant="secondary" isDisabled={pending || items.length === 0} onClick={() => void save()} />
      </HStack>
      {message ? (
        <Text type="supporting" as="p">
          {message}
        </Text>
      ) : null}
      {items.length > 0 ? (
        <Table density="compact" textOverflow="wrap" verticalAlign="top">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>标题</TableHeaderCell>
              <TableHeaderCell>链接</TableHeaderCell>
              <TableHeaderCell>价格/信号</TableHeaderCell>
              <TableHeaderCell>赛道猜测</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.url}>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <Link href={item.url} target="_blank" rel="noreferrer noopener">
                    {item.url}
                  </Link>
                </TableCell>
                <TableCell>{item.price_or_signal ?? "—"}</TableCell>
                <TableCell>{item.track_guess ?? item.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </VStack>
  );
}
