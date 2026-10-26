"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
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
  track_codes?: string[];
  side: Side;
  summary: string;
  relevant_excerpt?: string;
  opportunity_note?: string;
  region: string | null;
  scores: ScoreParts;
  rationale: string;
  mode: "heuristic" | "model";
};

const SITE_OPTIONS = MATERIAL_SITES.map((site) => ({ value: site.value, label: site.label }));
const SIDE_OPTIONS = Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }));

export function OpportunityForm({ tracks, onSaved }: { tracks: TrackOption[]; onSaved?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [site, setSite] = useState<MaterialSite>("zbj");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [signal, setSignal] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [side, setSide] = useState<Side>("demand");
  const [summary, setSummary] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [opportunity, setOpportunity] = useState("");
  const [scores, setScores] = useState<ScoreParts | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [mode, setMode] = useState<Suggestion["mode"] | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSave = title.trim().length > 0 && /^https?:\/\//i.test(url.trim());

  function applySuggestion(suggestion: Suggestion) {
    const codes = suggestion.track_codes?.length ? suggestion.track_codes : suggestion.track_code ? [suggestion.track_code] : [];
    setSelectedTracks(codes);
    setSide(suggestion.side);
    setSummary(suggestion.summary);
    setExcerpt(suggestion.relevant_excerpt ?? "");
    setOpportunity(suggestion.opportunity_note ?? "");
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
      setMessage(body.suggestion.mode === "model" ? "模型已补全，确认后写入案例。" : "没有模型密钥，已用本地规则补全。分数是价值分，确认后仍可写入。");
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
          signal,
          region,
          ...(assisted ? { track_codes: selectedTracks, side, summary, relevant_excerpt: excerpt, opportunity_note: opportunity, scores } : {}),
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
      setSignal("");
      setRegion("");
      setSummary("");
      setExcerpt("");
      setOpportunity("");
      setScores(null);
      setRationale(null);
      setMode(null);
      setAssisted(false);
      setSelectedTracks([]);
      setSide("demand");
      setMessage("已写入案例。");
      onSaved?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <VStack gap={3} className="entry-form">
      <TextInput label="标题" value={title} onChange={setTitle} placeholder="例如 企业知识库 RAG 搭建" width="100%" />
      <TextInput label="原链接" value={url} onChange={setUrl} placeholder="https://" width="100%" />
      <Selector label="站点" value={site} options={SITE_OPTIONS} onChange={(value) => setSite(value as MaterialSite)} width="100%" />
      <TextInput label="价格或信号" value={signal} onChange={setSignal} placeholder="可选，例如 预算 8000、面议、已有人报价" width="100%" isOptional />
      <TextInput label="地域" value={region} onChange={setRegion} placeholder="可选，例如 杭州" width="100%" isOptional />
      <TextArea
        label="你看到的内容"
        rows={4}
        value={notes}
        width="100%"
        onChange={setNotes}
        placeholder="求购、报价或笔记。不用粘贴整页搜索结果。"
      />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button label={pending ? "处理中" : "请 Agent 补全"} variant="primary" isDisabled={pending || title.trim().length < 2} onClick={() => void suggest()} />
        <Button label="写入案例" variant="secondary" isDisabled={pending || !canSave} onClick={() => void save()} />
        {message ? <Text type="supporting">{message}</Text> : null}
      </HStack>
      {assisted ? (
        <VStack gap={3}>
          <CheckboxList label="赛道" description="可以多选。都不选则不映射赛道。" value={selectedTracks} onChange={setSelectedTracks}>
            {tracks.map((item) => (
              <CheckboxListItem key={item.code} label={`${item.code} ${item.name}`} value={item.code} />
            ))}
          </CheckboxList>
          <Selector label="供需侧" value={side} options={SIDE_OPTIONS} onChange={(value) => setSide(value as Side)} />
          <TextArea label="摘要解读" rows={3} value={summary} width="100%" onChange={setSummary} />
          <TextArea label="相关片段" rows={2} value={excerpt} width="100%" onChange={setExcerpt} placeholder="原文里和工作室相关的那一句" />
          <TextArea label="和我们能力的关系" rows={2} value={opportunity} width="100%" onChange={setOpportunity} placeholder="例如能做知识库或界面 demo，不写申报流程" />
          {scores ? (
            <Text type="supporting" as="p">
              能力 {scores.capability} · 资金/窗口 {scores.funding_window} · 需求 {scores.demand_density} · 政策 {scores.policy_heat} · 竞争 {scores.competition} · demo {scores.demo_feasibility} · 合计 {scores.total}
              {mode === "heuristic" ? "。价值分，用来排序，不是调研结论。" : "。已按默认权重重算。"}
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
