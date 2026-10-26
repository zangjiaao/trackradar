"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { MATERIAL_SITES, SIDE_LABEL, type MaterialSite, type Side } from "@/lib/domain";
import type { ScoreParts } from "@/lib/scoring";

type TrackOption = { code: string; name: string };

type Suggestion = {
  track_code: string | null;
  side: Side;
  summary: string;
  region: string | null;
  scores: ScoreParts;
  rationale: string;
  mode: "heuristic" | "model";
};

const SITE_OPTIONS = MATERIAL_SITES.map((site) => ({ value: site.value, label: site.label }));
const SIDE_OPTIONS = Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }));

export function OpportunityForm({ tracks }: { tracks: TrackOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [site, setSite] = useState<MaterialSite>("zbj");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [track, setTrack] = useState("none");
  const [side, setSide] = useState<Side>("demand");
  const [summary, setSummary] = useState("");
  const [scores, setScores] = useState<ScoreParts | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [mode, setMode] = useState<Suggestion["mode"] | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const trackOptions = [{ value: "none", label: "未映射" }, ...tracks.map((item) => ({ value: item.code, label: `${item.code} ${item.name}` }))];
  const canSave = title.trim().length > 0 && /^https?:\/\//i.test(url.trim());

  function applySuggestion(suggestion: Suggestion) {
    setTrack(suggestion.track_code ?? "none");
    setSide(suggestion.side);
    setSummary(suggestion.summary);
    setRegion(suggestion.region ?? "");
    setScores(suggestion.scores);
    setRationale(suggestion.rationale);
    setMode(suggestion.mode);
    setAssisted(true);
  }

  async function suggest() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/opportunities/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, url, site, notes, region }),
      });
      const body = (await response.json()) as { suggestion?: Suggestion; error?: string };
      if (!response.ok || !body.suggestion) {
        setMessage(body.error ?? "补全失败");
        return;
      }
      applySuggestion(body.suggestion);
      setMessage(body.suggestion.mode === "model" ? "模型已补全，确认后写入机会清单。" : "没有模型密钥，已用本地规则补全。分数是骨架分，确认后仍可写入。");
    } finally {
      setPending(false);
    }
  }

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          site,
          notes,
          region,
          ...(assisted ? { track_code: track === "none" ? null : track, side, summary, scores } : {}),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "写入失败");
        return;
      }
      setTitle("");
      setUrl("");
      setNotes("");
      setRegion("");
      setSummary("");
      setScores(null);
      setRationale(null);
      setMode(null);
      setAssisted(false);
      setTrack("none");
      setSide("demand");
      setMessage("已写入机会清单。");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3}>
      <Grid columns={{ minWidth: 220, max: 2 }} gap={3}>
        <TextInput label="标题" value={title} onChange={setTitle} placeholder="例如 企业知识库 RAG 搭建" width="100%" />
        <TextInput label="原链接" value={url} onChange={setUrl} placeholder="https://" width="100%" />
        <Selector label="站点" value={site} options={SITE_OPTIONS} onChange={(value) => setSite(value as MaterialSite)} />
        <TextInput label="地域" value={region} onChange={setRegion} placeholder="可选，例如 杭州" width="100%" isOptional />
      </Grid>
      <TextArea
        label="你看到的内容"
        rows={4}
        value={notes}
        width="100%"
        onChange={setNotes}
        placeholder="报价、求购、笔记或政策里和这条有关的话。不用粘贴整页搜索结果。"
      />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "处理中" : "请 Agent 补全"} variant="primary" isDisabled={pending || title.trim().length < 2} onClick={() => void suggest()} />
        <Button label="写入机会清单" variant="secondary" isDisabled={pending || !canSave} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
      {assisted ? (
        <VStack gap={3}>
          <Grid columns={{ minWidth: 220, max: 2 }} gap={3}>
            <Selector label="赛道" value={track} options={trackOptions} onChange={setTrack} />
            <Selector label="供需侧" value={side} options={SIDE_OPTIONS} onChange={(value) => setSide(value as Side)} />
          </Grid>
          <TextArea label="摘要" rows={3} value={summary} width="100%" onChange={setSummary} />
          {scores ? (
            <Text type="supporting" as="p">
              能力 {scores.capability} · 资金/窗口 {scores.funding_window} · 需求 {scores.demand_density} · 政策 {scores.policy_heat} · 竞争 {scores.competition} · demo {scores.demo_feasibility} · 合计 {scores.total}
              {mode === "heuristic" ? "。骨架分，用来排序。" : "。已按默认权重重算。"}
            </Text>
          ) : null}
          {rationale ? (
            <Text type="supporting" as="p">
              {rationale}
            </Text>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}
