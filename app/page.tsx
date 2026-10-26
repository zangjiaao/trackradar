import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { OpportunityForm } from "@/components/opportunity-form";
import { PageHeader } from "@/components/page-header";
import { ORIGIN_LABEL, SIDE_LABEL, type Side } from "@/lib/domain";
import { siteLabel } from "@/lib/opportunity-draft";
import { listLeads, listTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  try {
    const [leads, tracks] = await Promise.all([listLeads(), listTracks()]);
    return (
      <VStack gap={6} maxWidth={1100} className="mx-auto w-full">
        <PageHeader
          title="机会清单"
          description="机会来自种子数据、信源试抓，以及你在外部站点人工找到后录入的素材。Agent 可以补全赛道、供需侧、摘要和打分建议，再写入这张清单。这些条目用来分析现状。每条都保留原始链接。"
        />
        {leads.length === 0 ? (
          <Text type="supporting" as="p">
            还没有机会。在下面录入一条素材，或到配置里试抓政策信源。
          </Text>
        ) : (
          <Table density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>标题与原链接</TableHeaderCell>
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
                    <VStack gap={1}>
                      <Text weight="medium">{lead.title}</Text>
                      <Link href={lead.url} target="_blank" rel="noreferrer noopener">
                        {lead.url}
                      </Link>
                      {lead.summary ? (
                        <Text type="supporting" as="p">
                          {lead.summary}
                        </Text>
                      ) : null}
                    </VStack>
                  </TableCell>
                  <TableCell>{lead.track_code ?? "—"}</TableCell>
                  <TableCell>{lead.side && lead.side in SIDE_LABEL ? SIDE_LABEL[lead.side as Side] : "—"}</TableCell>
                  <TableCell>{siteLabel(lead.site)}</TableCell>
                  <TableCell>{lead.region ?? "—"}</TableCell>
                  <TableCell>{lead.score_total ?? "—"}</TableCell>
                  <TableCell>{ORIGIN_LABEL[lead.origin] ?? lead.origin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <VStack gap={3} id="entry">
          <VStack gap={1}>
            <Heading level={2}>新增机会 / 素材</Heading>
            <Text type="supporting" as="p">
              到 OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝或视频号上人工查找，把标题、链接和你看到的内容填在这里。不自动爬取。补全后再写入上面的清单。常用站点说明在配置里。
            </Text>
          </VStack>
          <OpportunityForm tracks={tracks.map((track) => ({ code: track.code, name: track.name }))} />
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取机会清单失败"} />;
  }
}
