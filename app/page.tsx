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
          description="这里看助手从已配置信源带回的机会。想追问就回到对话。定时自动找新机会在任务页。下面的手动录入是辅助。每条都保留原始链接。"
        />
        {leads.length === 0 ? (
          <Text type="supporting" as="p">
            还没有机会。到对话里回看已启用信源，或在任务里执行一次定时任务。也可以在下面手动录入。
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
              辅助入口。主路径是对话或任务里按已配置信源回看。这里留给你在 OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝或视频号上人工找到的材料。不自动爬这些网站。
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
