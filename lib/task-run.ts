import type { AgentTaskRow } from "./domain";
import { runOpcScan } from "./opc-scan";
import { runSourceScan } from "./source-scan";

export function runTask(database: D1Database, task: AgentTaskRow, trigger: "manual" | "schedule") {
  const request = { lookbackDays: task.lookback_days, taskId: task.id, taskName: task.name, trigger, instruction: task.instruction };
  return task.task_type === "opc" ? runOpcScan(database, request) : runSourceScan(database, { ...request, budgetMs: 45_000 });
}
