import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { TaskList } from "@/components/task-list";
import { WorkLog } from "@/components/work-log";
import { listTasks } from "@/lib/tasks";
import { listWork } from "@/lib/work-log";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  try {
    const [tasks, jobs] = await Promise.all([listTasks(), listWork()]);
    return (
      <VStack gap={4} className="page-column">
        <PageHeader
          title="任务"
          description="添加每天或每周一的定时任务，让助手按配置里已启用的信源把新政策写入政策页。下面同时留下每次去过哪些信源、写入了多少条。对话里的回看也记在这里。"
        />
        <Card>
          <VStack gap={3}>
            <Heading level={2}>添加定时任务</Heading>
            <Text type="supporting" as="p">
              周期对应 Worker 里已有的两条 Cron：每天 10:00，或每周一 09:00（北京时间）。执行时先采集标题、发表时间、出处、正文和 PDF 附件。有模型时按政府在用、在采的产品写一段解读，方便定 demo；无关的不进政策页。没有密钥时不写入政策页。执行记录写采集、评了、低分过滤、解读写入。信源开关在{" "}
              <Link href="/settings#sources">配置</Link>。
            </Text>
            <TaskForm />
          </VStack>
        </Card>
        <VStack gap={3}>
          <Heading level={2}>已添加的任务</Heading>
          <TaskList tasks={tasks} />
        </VStack>
        <WorkLog jobs={jobs} />
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取任务失败"} />;
  }
}
