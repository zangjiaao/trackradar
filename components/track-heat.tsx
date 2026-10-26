"use client";

import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
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
}: {
  tracks: { code: string; name: string }[];
  heat: Record<string, HeatStat>;
  selected: string | null;
}) {
  const router = useRouter();
  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap" className="track-filters">
        <Button label="全部赛道" size="sm" variant={selected ? "secondary" : "primary"} onClick={() => router.push("/")} />
        {tracks.map((track) => (
          <Button
            key={track.code}
            label={`${track.code} ${track.name} · ${heatText(heat[track.code])}`}
            size="sm"
            variant={selected === track.code ? "primary" : "secondary"}
            onClick={() => router.push(`/?track=${track.code}`)}
          />
        ))}
      </HStack>
      <Text type="supporting" as="p">
        每个筛选都写全赛道代号和名称，后面是条数，以及近 7 日相对再往前 7 日的增减。一条机会可以同时计入多个赛道。
      </Text>
    </VStack>
  );
}
