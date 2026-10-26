import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { WEIGHT_LABELS, WEIGHTS } from "@/lib/domain";
import { counts, listJobs, listTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const [summary, tracks, jobs] = await Promise.all([counts(), listTracks(), listJobs(5)]);
    const stats = [
      ["赛道", summary.tracks, "/tracks"],
      ["线索", summary.leads, "/leads"],
      ["采样", summary.samples, "/samples"],
      ["信源", summary.sources, "/sources"],
    ] as const;
    return (
      <VStack gap={4} maxWidth={960} className="mx-auto w-full">
        <PageHeader
          title="选出更能接到订单的 AI 软件赛道"
          description="工作室做智能体研发、知识库与业务知识治理、FDE 前场部署交接。雷达只映射 T01–T10，不进入汽车、机器人、具身硬件和芯片制造。"
        />
        <Grid columns={{ minWidth: 160, max: 4 }} gap={3}>
          {stats.map(([label, value, href]) => (
            <ClickableCard key={href} label={`${label} ${value}`} href={href}>
              <VStack gap={1}>
                <Text type="supporting">{label}</Text>
                <Heading level={2}>{value}</Heading>
              </VStack>
            </ClickableCard>
          ))}
        </Grid>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={4}>
          <Card>
            <VStack gap={2}>
              <Heading level={2}>默认打分权重</Heading>
              <Text type="supporting" as="p">
                竞争分越高表示竞争越低。当前分数是骨架分，用来排序线索，不是调研结论。
              </Text>
              <Text as="p">
                {WEIGHT_LABELS.map((item) => `${item.label} ${Math.round(WEIGHTS[item.key] * 100)}%`).join(" · ")}
              </Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={2}>
              <Heading level={2}>定时任务</Heading>
              <Text type="supporting" as="p">
                每日政策巡检与每周周报仍是占位，触发后只写入 crawl_jobs。
              </Text>
              {jobs.length === 0 ? (
                <Text type="supporting" as="p">
                  还没有触发记录。
                </Text>
              ) : (
                jobs.map((job) => (
                  <Text key={job.id} as="p">
                    {job.kind} · {job.status} · {job.message}
                  </Text>
                ))
              )}
            </VStack>
          </Card>
        </Grid>
        <Grid columns={{ minWidth: 280, max: 2 }} gap={3}>
          {tracks.slice(0, 4).map((track) => (
            <Card key={track.code} variant="muted">
              <VStack gap={1}>
                <Heading level={3}>
                  {track.code} {track.name}
                </Heading>
                <Text type="supporting" as="p">
                  {track.summary}
                </Text>
              </VStack>
            </Card>
          ))}
        </Grid>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取数据库失败"} />;
  }
}
