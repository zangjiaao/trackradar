"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@astryxdesign/core/Selector";
import { opportunityHref, type LeadSort } from "@/lib/lead-presentation";
import type { HeatStat } from "@/lib/track-heat";

function heatText(stat: HeatStat | undefined): string {
  const count = stat?.total ?? 0;
  const delta = stat?.delta ?? 0;
  const trend = delta > 0 ? `近7日 +${delta}` : delta < 0 ? `近7日 ${delta}` : "近7日持平";
  return `${count}条 · ${trend}`;
}

export function TrackHeat({
  tracks,
  heat,
  selected,
  sort,
  base = "/",
}: {
  tracks: { code: string; name: string }[];
  heat: Record<string, HeatStat>;
  selected: string | null;
  sort: LeadSort;
  base?: "/" | "/cases";
}) {
  const router = useRouter();
  const options = [
    { value: "all", label: "全部赛道" },
    ...tracks.map((track) => ({
      value: track.code,
      label: `${track.code} ${track.name} · ${heatText(heat[track.code])}`,
    })),
  ];

  return (
    <div className="track-select">
      <Selector
        label="赛道"
        value={selected ?? "all"}
        options={options}
        onChange={(value) => router.push(opportunityHref(!value || value === "all" ? null : value, sort, base))}
        width="100%"
      />
    </div>
  );
}
