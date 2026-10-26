import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { SampleImporter } from "@/components/sample-importer";
import { PLATFORM_LABEL, SIDE_LABEL, type Platform, type Side } from "@/lib/domain";
import { listKeywordSets, listSamples } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  try {
    const [samples, keywords] = await Promise.all([listSamples(), listKeywordSets()]);
    return (
      <VStack gap={6} maxWidth={1100} className="mx-auto w-full">
        <VStack gap={4}>
          <PageHeader
            title="粘贴解析采样"
            description="不做全站爬取。把闲鱼、淘宝或视频号的搜索结果粘贴进来，抽出标题和链接，预览后再写入 manual_samples。"
          />
          <SampleImporter />
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>采样关键词</Heading>
          <Grid columns={{ minWidth: 220, max: 3 }} gap={3}>
            {keywords.map((set) => (
              <Card key={set.id} variant="muted">
                <VStack gap={1}>
                  <Text weight="medium">{set.name}</Text>
                  <Text type="supporting" as="p">
                    {set.keywords}
                  </Text>
                  <Text type="supporting">猜测赛道 {set.track_code ?? "—"}</Text>
                </VStack>
              </Card>
            ))}
          </Grid>
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>已入库采样</Heading>
          <Table density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>时间</TableHeaderCell>
                <TableHeaderCell>平台</TableHeaderCell>
                <TableHeaderCell>关键词</TableHeaderCell>
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
                  <TableCell>{sample.keyword ?? "—"}</TableCell>
                  <TableCell>
                    <VStack gap={1}>
                      <Text>{sample.title}</Text>
                      <Link href={sample.url} target="_blank" rel="noreferrer noopener">
                        {sample.url}
                      </Link>
                      {sample.note ? (
                        <Text type="supporting" as="p">
                          {sample.note}
                        </Text>
                      ) : null}
                    </VStack>
                  </TableCell>
                  <TableCell>{sample.side ? (SIDE_LABEL[sample.side as Side] ?? sample.side) : "—"}</TableCell>
                  <TableCell>{sample.price_or_signal ?? "—"}</TableCell>
                  <TableCell>{sample.track_guess ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取采样失败"} />;
  }
}
