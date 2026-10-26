import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { SourceActions } from "@/components/source-actions";
import { listJobs, listSources } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  try {
    const [sources, jobs] = await Promise.all([listSources(), listJobs()]);
    return (
      <VStack gap={4} maxWidth={960} className="mx-auto w-full">
        <PageHeader
          title="政策信源"
          description="六地种子写在 sources 表。通用适配器读取列表页里的标题和链接。上海产业发展、北京通知公告、深圳工信局、西安工信局的列表在开发时可以抽出条目；门户首页可能只有导航。"
        />
        <VStack gap={3}>
          {sources.map((source) => (
            <Card key={source.id}>
              <HStack gap={3} justify="between" vAlign="start" wrap="wrap">
                <VStack gap={1}>
                  <Text weight="medium">
                    {source.region} · {source.name}
                  </Text>
                  <Link href={source.list_url} target="_blank" rel="noreferrer noopener">
                    {source.list_url}
                  </Link>
                  {source.notes ? (
                    <Text type="supporting" as="p">
                      {source.notes}
                    </Text>
                  ) : null}
                </VStack>
                <SourceActions sourceId={source.id} />
              </HStack>
            </Card>
          ))}
        </VStack>
        <VStack gap={2}>
          <Heading level={2}>最近任务</Heading>
          {jobs.length === 0 ? (
            <Text type="supporting" as="p">
              还没有抓取或定时记录。
            </Text>
          ) : (
            jobs.map((job) => (
              <Text key={job.id} type="supporting" as="p">
                {job.kind} · {job.status} · {job.message}
              </Text>
            ))
          )}
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取信源失败"} />;
  }
}
