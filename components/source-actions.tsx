"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void run(false)}>
          {pending === "preview" ? "抓取中" : "试抓"}
        </Button>
        <Button type="button" size="sm" disabled={pending !== null} onClick={() => void run(true)}>
          {pending === "save" ? "写入中" : "抓取并写入线索"}
        </Button>
      </div>
      {preview ? (
        <div className="space-y-1 text-xs leading-5 text-muted-foreground">
          <p>{preview.error ? `失败：${preview.error}` : `抽到 ${preview.items.length} 条${preview.saved ? `，新写入 ${preview.saved} 条` : ""}`}</p>
          {preview.items.slice(0, 3).map((item) => (
            <p key={item.url}>
              <a className="text-primary underline-offset-4 hover:underline" href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
