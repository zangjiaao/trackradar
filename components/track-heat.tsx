"use client";

import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { trendLabel, type HeatStat } from "@/lib/track-heat";

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
      <HStack gap={2} wrap="wrap">
        <Button label="全部" size="sm" variant={selected ? "secondary" : "primary"} onClick={() => router.push("/")} />
        {tracks.map((track) => {
          const stat = heat[track.code];
          const count = stat?.total ?? 0;
          return (
            <Button
              key={track.code}
              label={`${track.code} ${count} ${trendLabel(stat?.delta ?? 0)}`}
              size="sm"
              variant={selected === track.code ? "primary" : "secondary"}
              onClick={() => router.push(`/?track=${track.code}`)}
            />
          );
        })}
      </HStack>
      <Text type="supporting" as="p">
        数字是条数，箭头是近 7 日相对再往前 7 日的增减。一条机会可以同时计入多个赛道。
      </Text>
    </VStack>
  );
}
