import { HStack } from "@astryxdesign/core/HStack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { LeadCell } from "@/components/lead-cell";
import { OpportunityEntry } from "@/components/opportunity-entry";
import { PageHeader } from "@/components/page-header";
import { TrackHeat } from "@/components/track-heat";
import { ORIGIN_LABEL, SIDE_LABEL, type Side } from "@/lib/domain";
import { isTrackCode } from "@/lib/lead-tracks";
import { siteLabel } from "@/lib/opportunity-draft";
import { listLeads, listTrackEvents, listTracks } from "@/lib/queries";
import { trackHeat } from "@/lib/track-heat";

export const dynamic = "force-dynamic";

function trackTags(codes: string[], names: Map<string, string>): string {
  if (codes.length === 0) return "—";
  return codes
    .map((code) => {
      const short = names.get(code)?.split(/[/／]/)[0]?.trim();
      return short ? `${code} ${short}` : code;
    })
    .join(" · ");
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ track?: string }> | { track?: string };
}) {
  try {
    const params = searchParams ? await searchParams : {};
    const requested = typeof params.track === "string" ? params.track : "";
    const track = isTrackCode(requested) ? requested : null;
    const [leads, tracks, events] = await Promise.all([listLeads(50, track), listTracks(), listTrackEvents()]);
    const names = new Map(tracks.map((item) => [item.code, item.name]));
    const heat = trackHeat(events);
    return (
      <VStack gap={4} className="page-column">
        <HStack gap={3} wrap="wrap" justify="between" vAlign="end">
          <PageHeader
            title="机会清单"
            description="这里看助手从已配置信源带回的机会。政策会先解读，关系不大或过宽的不会进来。解读默认只露两行，原链接只显示域名。想追问就回到对话。"
          />
          <OpportunityEntry tracks={tracks.map((item) => ({ code: item.code, name: item.name }))} />
        </HStack>
        <TrackHeat tracks={tracks.map((item) => ({ code: item.code, name: item.name }))} heat={heat} selected={track} />
        {leads.length === 0 ? (
          <Text type="supporting" as="p">
            {track ? "这个赛道还没有机会。" : "还没有机会。到对话里从信源拉取，或在任务里执行一次定时任务。也可以点「新增」手动录入。"}
          </Text>
        ) : (
          <div className="lead-scroll">
          <Table className="lead-table" density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>标题</TableHeaderCell>
                <TableHeaderCell>赛道</TableHeaderCell>
                <TableHeaderCell>侧</TableHeaderCell>
                <TableHeaderCell>站点</TableHeaderCell>
                <TableHeaderCell>地域</TableHeaderCell>
                <TableHeaderCell>骨架分</TableHeaderCell>
                <TableHeaderCell>来源</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <LeadCell
                      title={lead.title}
                      url={lead.url}
                      summary={lead.summary}
                      excerpt={lead.relevant_excerpt}
                      opportunity={lead.opportunity_note}
                    />
                  </TableCell>
                  <TableCell>{trackTags(lead.track_codes, names)}</TableCell>
                  <TableCell>{lead.side && lead.side in SIDE_LABEL ? SIDE_LABEL[lead.side as Side] : "—"}</TableCell>
                  <TableCell>{siteLabel(lead.site)}</TableCell>
                  <TableCell>{lead.region ?? "—"}</TableCell>
                  <TableCell>{lead.score_total ?? "—"}</TableCell>
                  <TableCell>{ORIGIN_LABEL[lead.origin] ?? lead.origin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取机会清单失败"} />;
  }
}
