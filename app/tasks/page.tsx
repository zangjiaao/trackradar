import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { TaskEntry } from "@/components/task-entry";
import { HStack } from "@astryxdesign/core/HStack";
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
        <HStack gap={3} wrap="wrap" justify="between" vAlign="center">
          <PageHeader title="任务" description="采集政策或 OPC圈案例。定时任务按北京时间执行，手动任务按需运行；采集进度和结果记录在下方，页面每 5 秒自动更新。" />
          <TaskEntry />
        </HStack>
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
