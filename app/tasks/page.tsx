import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { listTasks } from "@/lib/tasks";
import { WORK_KIND_LABEL, WORK_STATUS_LABEL, listWork } from "@/lib/work-log";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  try {
    const [tasks, jobs] = await Promise.all([listTasks(), listWork()]);
    return (
      <VStack gap={4} maxWidth={1100} className="mx-auto w-full">
        <PageHeader
          title="任务"
          description="添加每天或每周一的定时任务，让助手按配置里已启用的信源自动找新机会。下面同时留下每次去过哪些信源、写入了多少条。对话里的回看也记在这里。"
        />
        <Card>
          <VStack gap={3}>
            <Heading level={2}>添加定时任务</Heading>
            <Text type="supporting" as="p">
              周期对应 Worker 里已有的两条 Cron：每天 10:00，或每周一 09:00（北京时间）。执行时只读列表页，筛出约一年内能映射到 T01–T10 的条目。信源开关在{" "}
              <Link href="/settings#sources">配置</Link>。
            </Text>
            <TaskForm />
          </VStack>
        </Card>
        <VStack gap={3}>
          <Heading level={2}>已添加的任务</Heading>
          <TaskList tasks={tasks} />
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>执行记录</Heading>
          {jobs.length === 0 ? (
            <Text type="supporting" as="p">
              还没有记录。可以在对话里回看信源，或对上面的任务点立即执行。
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
                        {job.task_name ? <Text type="supporting">{job.task_name}</Text> : null}
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
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取任务失败"} />;
  }
}
