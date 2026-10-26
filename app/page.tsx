import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { OpportunityCard } from "@/components/opportunity-card";
import { OpportunityEntry } from "@/components/opportunity-entry";
import { OpportunitySort } from "@/components/opportunity-sort";
import { PageHeader } from "@/components/page-header";
import { RereadButton } from "@/components/reread-button";
import { TrackHeat } from "@/components/track-heat";
import { isTrackCode } from "@/lib/lead-tracks";
import { LEAD_SORT_OPTIONS, VALUE_SCORE_FORMULA, parseLeadSort, sortLeads } from "@/lib/lead-presentation";
import { listLeads, listTrackEvents, listTracks } from "@/lib/queries";
import { trackHeat } from "@/lib/track-heat";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ track?: string; sort?: string }> | { track?: string; sort?: string };
}) {
  try {
    const params = searchParams ? await searchParams : {};
    const requested = typeof params.track === "string" ? params.track : "";
    const track = isTrackCode(requested) ? requested : null;
    const sort = parseLeadSort(typeof params.sort === "string" ? params.sort : "");
    const sortCaption = LEAD_SORT_OPTIONS.find((item) => item.value === sort)?.caption ?? "当前按价值分从高到低排列。";
    const [leads, tracks, events] = await Promise.all([listLeads(200, track), listTracks(), listTrackEvents()]);
    const names = new Map(tracks.map((item) => [item.code, item.name]));
    const heat = trackHeat(events);
    const ordered = sortLeads(leads, sort);
    return (
      <VStack gap={4} className="page-column opportunity-list">
        <HStack gap={3} wrap="wrap" justify="between" vAlign="end">
          <PageHeader
            title="机会"
            description="用来找有价值的情报。卡片先写我们能接什么、政策福利、参与路径和门槛。有原文发布日就标「发布」，只有抓取入库日就标「入库」。价值分只显示数字。市场案例从「新增」录入，站点含猪八戒和 Fiverr。"
          />
          <OpportunityEntry tracks={tracks.map((item) => ({ code: item.code, name: item.name }))} />
        </HStack>
        <HStack gap={3} wrap="wrap" vAlign="end" className="opportunity-toolbar">
          <TrackHeat tracks={tracks.map((item) => ({ code: item.code, name: item.name }))} heat={heat} selected={track} sort={sort} />
          <OpportunitySort track={track} sort={sort} />
          <RereadButton />
        </HStack>
        <VStack gap={1}>
          <Text type="supporting" as="p">
            {sortCaption}
          </Text>
          <details className="score-details">
            <summary>价值分怎么算</summary>
            <Text type="supporting" as="p">
              {VALUE_SCORE_FORMULA}
            </Text>
          </details>
        </VStack>
        {ordered.length === 0 ? (
          <Text type="supporting" as="p">
            {track ? "这个赛道还没有机会。" : "还没有机会。到对话里从信源拉取，或在任务里执行一次定时任务。也可以点「新增」手动录入。"}
          </Text>
        ) : (
          <div className="opportunity-cards">
            {ordered.map((lead) => (
              <OpportunityCard key={lead.id} lead={lead} names={names} />
            ))}
          </div>
        )}
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取机会清单失败"} />;
  }
}
