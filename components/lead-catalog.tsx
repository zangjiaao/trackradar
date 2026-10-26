import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { CaseCard } from "@/components/case-card";
import { DbFallback } from "@/components/db-fallback";
import { OpportunityCard } from "@/components/opportunity-card";
import { OpportunityEntry } from "@/components/opportunity-entry";
import { OpportunitySort } from "@/components/opportunity-sort";
import { PageHeader } from "@/components/page-header";
import { RereadButton } from "@/components/reread-button";
import { TrackHeat } from "@/components/track-heat";
import type { LeadKind } from "@/lib/lead-kind";
import { isTrackCode } from "@/lib/lead-tracks";
import { LEAD_SORT_OPTIONS, VALUE_SCORE_FORMULA, parseLeadSort, sortLeads } from "@/lib/lead-presentation";
import { listLeads, listTrackEvents, listTracks } from "@/lib/queries";
import { trackHeat } from "@/lib/track-heat";

export async function LeadCatalog({
  kind,
  title,
  description,
  emptyAll,
  emptyTrack,
  base,
  entry = false,
  reread = false,
  searchParams,
}: {
  kind: LeadKind;
  title: string;
  description: string;
  emptyAll: string;
  emptyTrack: string;
  base: "/" | "/cases";
  entry?: boolean;
  reread?: boolean;
  searchParams?: Promise<{ track?: string; sort?: string }> | { track?: string; sort?: string };
}) {
  try {
    const params = searchParams ? await searchParams : {};
    const requested = typeof params.track === "string" ? params.track : "";
    const track = isTrackCode(requested) ? requested : null;
    const sort = parseLeadSort(typeof params.sort === "string" ? params.sort : "");
    const sortCaption = LEAD_SORT_OPTIONS.find((item) => item.value === sort)?.caption ?? "当前按价值分从高到低排列。";
    const [leads, tracks, events] = await Promise.all([listLeads(200, track, kind), listTracks(), listTrackEvents(kind)]);
    const names = new Map(tracks.map((item) => [item.code, item.name]));
    const heat = trackHeat(events);
    const ordered = sortLeads(leads, sort);
    const trackOptions = tracks.map((item) => ({ code: item.code, name: item.name }));
    return (
      <VStack gap={4} className="page-column opportunity-list">
        <HStack gap={3} wrap="wrap" justify="between" vAlign="end">
          <PageHeader title={title} description={description} />
          {entry ? <OpportunityEntry tracks={trackOptions} /> : null}
        </HStack>
        <HStack gap={3} wrap="wrap" vAlign="end" className="opportunity-toolbar">
          <TrackHeat tracks={trackOptions} heat={heat} selected={track} sort={sort} base={base} />
          <OpportunitySort track={track} sort={sort} base={base} />
          {reread ? <RereadButton /> : null}
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
            {track ? emptyTrack : emptyAll}
          </Text>
        ) : (
          <div className="opportunity-cards">
            {ordered.map((lead) =>
              kind === "case" ? <CaseCard key={lead.id} lead={lead} names={names} /> : <OpportunityCard key={lead.id} lead={lead} names={names} />,
            )}
          </div>
        )}
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : `读取${title}失败`} />;
  }
}
