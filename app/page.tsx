import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { SampleImporter } from "@/components/sample-importer";
import { PLATFORM_LABEL, SIDE_LABEL, type Platform, type Side } from "@/lib/domain";
import { listLeads, listSamples } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  try {
    const [leads, samples] = await Promise.all([listLeads(), listSamples()]);
    return (
      <VStack gap={6} maxWidth={1100} className="mx-auto w-full">
        <PageHeader
          title="机会清单"
          description="按配置里的信源和周期收集。定时触发目前只记任务，真正写入来自种子数据、信源试抓和下面的采样。每条都保留原始链接。"
        />
        {leads.length === 0 ? (
          <Text type="supporting" as="p">
            还没有机会。到配置里启用信源并试抓，或在下面粘贴采样。
          </Text>
        ) : (
          <Table density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>标题与原链接</TableHeaderCell>
                <TableHeaderCell>赛道</TableHeaderCell>
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
                  <TableCell>{lead.region ?? "—"}</TableCell>
                  <TableCell>{lead.score_total ?? "—"}</TableCell>
                  <TableCell>{lead.origin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <VStack gap={4} id="samples">
          <VStack gap={1}>
            <Heading level={2}>采样信号</Heading>
            <Text type="supporting" as="p">
              不做全站爬取。把闲鱼、淘宝或视频号的搜索结果粘贴进来，抽出标题和链接后写入采样，对话会读到最近几条。
            </Text>
          </VStack>
          <SampleImporter />
          <Heading level={3}>已入库采样</Heading>
          {samples.length === 0 ? (
            <Text type="supporting" as="p">
              还没有采样。
            </Text>
          ) : (
            <Table density="compact" textOverflow="wrap" verticalAlign="top">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>时间</TableHeaderCell>
                  <TableHeaderCell>平台</TableHeaderCell>
                  <TableHeaderCell>标题与链接</TableHeaderCell>
                  <TableHeaderCell>侧</TableHeaderCell>
                  <TableHeaderCell>价格/信号</TableHeaderCell>
                  <TableHeaderCell>赛道</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell>{sample.sampled_at.slice(0, 16)}</TableCell>
                    <TableCell>{PLATFORM_LABEL[sample.platform as Platform] ?? sample.platform}</TableCell>
                    <TableCell>
                      <VStack gap={1}>
                        <Text>{sample.title}</Text>
                        <Link href={sample.url} target="_blank" rel="noreferrer noopener">
                          {sample.url}
                        </Link>
                      </VStack>
                    </TableCell>
                    <TableCell>{sample.side ? (SIDE_LABEL[sample.side as Side] ?? sample.side) : "—"}</TableCell>
                    <TableCell>{sample.price_or_signal ?? "—"}</TableCell>
                    <TableCell>{sample.track_guess ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取机会清单失败"} />;
  }
}
