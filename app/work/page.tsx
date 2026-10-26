import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { WORK_KIND_LABEL, WORK_STATUS_LABEL, listWork } from "@/lib/work-log";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  try {
    const jobs = await listWork();
    return (
      <VStack gap={4} maxWidth={1100} className="mx-auto w-full">
        <PageHeader
          title="工作"
          description="Agent 去过哪里、跑过哪些抓取和定时任务。试抓、Cron 占位和对话里的工具调用都记在这里，方便事后核对。"
        />
        {jobs.length === 0 ? (
          <Text type="supporting" as="p">
            还没有记录。到<Link href="/settings#sources">配置</Link>里试抓一条信源，或等定时任务触发。
          </Text>
        ) : (
          <Table density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>时间</TableHeaderCell>
                <TableHeaderCell>动作</TableHeaderCell>
                <TableHeaderCell>状态</TableHeaderCell>
                <TableHeaderCell>记录</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.created_at.slice(0, 16).replace("T", " ")}</TableCell>
                  <TableCell>
                    <VStack gap={1}>
                      <Text>{WORK_KIND_LABEL[job.kind] ?? job.kind}</Text>
                      {job.source_name ? (
                        <Text type="supporting">
                          {job.source_region} · {job.source_name}
                        </Text>
                      ) : null}
                    </VStack>
                  </TableCell>
                  <TableCell>{WORK_STATUS_LABEL[job.status] ?? job.status}</TableCell>
                  <TableCell>{job.message ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取工作记录失败"} />;
  }
}
