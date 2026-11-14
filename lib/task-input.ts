import { isCadence, type TaskCadence } from "@/lib/collect";
import { normalizeLookback } from "@/lib/source-window";

export type TaskInput = {
  name: string;
  cadence: TaskCadence;
  taskType: "policy" | "opc";
  lookbackDays: number;
  instruction: string;
  enabled: boolean;
};

export const DEFAULT_INSTRUCTION = "到已配置信源回看约一年：先采集正文和 PDF 附件。有模型时按政府在用、在采的产品写一段解读，方便定 demo；无关的不进入政策页。没有密钥时不写入政策页。";

export const OPC_INSTRUCTION = "采集 OPC圈广场最近 30 天的产品和需求，按现有赛道筛选智能体、知识库、FDE 和软件数字化案例。按原文区分供给和需求，保留原链接和价格信号。";

export function parseTaskInput(body: Record<string, unknown>, partial = false): TaskInput {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const cadenceValue = typeof body.cadence === "string" ? body.cadence : "daily";
  if (!isCadence(cadenceValue) && cadenceValue !== "manual") throw new Error("周期只能是每天、每周一或仅手动。");
  const taskType = body.taskType ?? body.task_type ?? "policy";
  if (taskType !== "policy" && taskType !== "opc") throw new Error("采集目标只能是政策或 OPC 案例。");
  const defaultInstruction = taskType === "opc" ? OPC_INSTRUCTION : DEFAULT_INSTRUCTION;
  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 400) : partial ? "" : defaultInstruction;
  if (!partial && name.length < 2) throw new Error("请给任务起个名字。");
  if (!partial && instruction.length < 4) throw new Error("请写清这个任务要找什么。");
  return {
    name,
    taskType,
    cadence: cadenceValue,
    lookbackDays: normalizeLookback(body.lookbackDays ?? body.lookback_days ?? (taskType === "opc" ? 30 : 365)),
    instruction: instruction || defaultInstruction,
    enabled: body.enabled === false ? false : true,
  };
}
