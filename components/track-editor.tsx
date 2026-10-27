"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";

export type EditableTrack = {
  code: string;
  name: string;
  summary: string;
  studio_fit: string;
  keywords: string;
};

export function TrackEditor({ tracks }: { tracks: EditableTrack[] }) {
  const router = useRouter();
  const [code, setCode] = useState(tracks[0]?.code ?? "");
  const [name, setName] = useState(tracks[0]?.name ?? "");
  const [summary, setSummary] = useState(tracks[0]?.summary ?? "");
  const [studioFit, setStudioFit] = useState(tracks[0]?.studio_fit ?? "");
  const [keywords, setKeywords] = useState(tracks[0]?.keywords ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const current = tracks.find((track) => track.code === code);
    if (!current) return;
    setName(current.name);
    setSummary(current.summary);
    setStudioFit(current.studio_fit);
    setKeywords(current.keywords);
  }, [tracks, code]);

  if (tracks.length === 0) {
    return (
      <Text type="supporting" as="p">
        还没有赛道。请先执行 npm run db:migrate。
      </Text>
    );
  }

  const current = tracks.find((track) => track.code === code);
  const dirty =
    Boolean(current) &&
    (name !== current?.name || summary !== current?.summary || studioFit !== current?.studio_fit || keywords !== current?.keywords);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          const response = await fetch("/api/tracks", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, name, summary, studio_fit: studioFit, keywords }),
          });
          const body = (await response.json()) as { error?: string };
          setMessage(response.ok ? `已保存 ${code}。之后的回看会按这些关键词打标签。` : (body.error ?? "保存失败"));
          if (response.ok) router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <VStack gap={3}>
        <Selector
          label="赛道"
          value={code}
          options={tracks.map((track) => ({ value: track.code, label: `${track.code} ${track.name}` }))}
          onChange={setCode}
        />
        <TextInput label="名称" value={name} onChange={setName} width="100%" />
        <TextArea label="说明" rows={3} value={summary} onChange={setSummary} width="100%" />
        <TextArea label="工作室怎么接" rows={3} value={studioFit} onChange={setStudioFit} width="100%" />
        <TextArea label="关键词" rows={5} value={keywords} onChange={setKeywords} width="100%" placeholder="一行一个。留空则用内置词。" />
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Button label={pending ? "保存中" : "保存赛道"} type="submit" variant="primary" isDisabled={pending || !dirty} />
          {message ? <Text type="supporting">{message}</Text> : null}
        </HStack>
      </VStack>
    </form>
  );
}
