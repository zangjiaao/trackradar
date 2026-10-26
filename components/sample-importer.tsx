"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABEL, SIDE_LABEL, type ParsedSample, type Platform, type Side } from "@/lib/domain";

type Preview = ParsedSample & { platform: Platform; keyword: string; side: Side };

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
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <Label>平台</Label>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as Platform)}
          >
            {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <Label>供需侧</Label>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={side}
            onChange={(event) => setSide(event.target.value as Side)}
          >
            {Object.entries(SIDE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <Label>关键词</Label>
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="例如 企业知识库" />
        </label>
      </div>
      <Textarea
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"粘贴搜索结果。支持：\n标题\nhttps://example.com/item\n¥1999\n\n或 [标题](https://example.com)"}
      />
      <div className="flex gap-2">
        <Button type="button" onClick={() => void parse()} disabled={pending || text.trim().length === 0}>
          解析预览
        </Button>
        <Button type="button" variant="outline" onClick={() => void save()} disabled={pending || items.length === 0}>
          写入采样表
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">标题</th>
                <th className="px-3 py-2 font-medium">链接</th>
                <th className="px-3 py-2 font-medium">价格/信号</th>
                <th className="px-3 py-2 font-medium">赛道猜测</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.url} className="border-t">
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2">
                    <a className="break-all text-primary underline-offset-4 hover:underline" href={item.url} target="_blank" rel="noreferrer">
                      {item.url}
                    </a>
                  </td>
                  <td className="px-3 py-2">{item.price_or_signal ?? "—"}</td>
                  <td className="px-3 py-2">{item.track_guess ?? item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
