import type { AgentTaskRow } from "@/lib/domain";
import { getDb } from "@/lib/db";
import { parseTaskInput, type TaskInput } from "@/lib/task-input";

export { parseTaskInput };
export type { TaskInput };

export async function listTasks(database: D1Database = getDb()): Promise<AgentTaskRow[]> {
  const { results } = await database
    .prepare("SELECT id, name, cadence, lookback_days, instruction, enabled, created_at FROM agent_tasks ORDER BY created_at DESC")
    .all<AgentTaskRow>();
  return results;
}

export async function createTask(input: TaskInput, database: D1Database = getDb()): Promise<AgentTaskRow> {
  const count = await database.prepare("SELECT COUNT(*) AS total FROM agent_tasks").first<{ total: number }>();
  if ((count?.total ?? 0) >= 12) throw new Error("最多保留 12 个任务。可以先删掉不用的。");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO agent_tasks (id, name, cadence, lookback_days, instruction, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.name, input.cadence, input.lookbackDays, input.instruction, input.enabled ? 1 : 0, now, now)
    .run();
  const created = await database
    .prepare("SELECT id, name, cadence, lookback_days, instruction, enabled, created_at FROM agent_tasks WHERE id = ?")
    .bind(id)
    .first<AgentTaskRow>();
  if (!created) throw new Error("任务已写入，但读取失败。");
  return created;
}

export async function setTaskEnabled(id: string, enabled: boolean, database: D1Database = getDb()): Promise<void> {
  const existing = await database.prepare("SELECT id FROM agent_tasks WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) throw new Error("找不到这个任务。");
  await database.prepare("UPDATE agent_tasks SET enabled = ?, updated_at = ? WHERE id = ?").bind(enabled ? 1 : 0, new Date().toISOString(), id).run();
}

export async function deleteTask(id: string, database: D1Database = getDb()): Promise<void> {
  const existing = await database.prepare("SELECT id FROM agent_tasks WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) throw new Error("找不到这个任务。");
  await database.prepare("DELETE FROM agent_tasks WHERE id = ?").bind(id).run();
}

export async function getTask(id: string, database: D1Database = getDb()): Promise<AgentTaskRow | null> {
  return database
    .prepare("SELECT id, name, cadence, lookback_days, instruction, enabled, created_at FROM agent_tasks WHERE id = ?")
    .bind(id)
    .first<AgentTaskRow>();
}
