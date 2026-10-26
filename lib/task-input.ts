import { isCadence, type Cadence } from "@/lib/collect";
import { normalizeLookback } from "@/lib/source-window";

export type TaskInput = {
  name: string;
  cadence: Cadence;
  lookbackDays: number;
  instruction: string;
  enabled: boolean;
};

export const DEFAULT_INSTRUCTION = "到已配置信源回看约一年，把能映射到 T01–T10 的条目写入机会清单。";

export function parseTaskInput(body: Record<string, unknown>, partial = false): TaskInput {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const cadenceValue = typeof body.cadence === "string" ? body.cadence : "daily";
  if (!isCadence(cadenceValue)) throw new Error("周期只能是每天或每周一。");
  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 400) : partial ? "" : DEFAULT_INSTRUCTION;
  if (!partial && name.length < 2) throw new Error("请给任务起个名字。");
  if (!partial && instruction.length < 4) throw new Error("请写清这个任务要找什么。");
  return {
    name,
    cadence: cadenceValue,
    lookbackDays: normalizeLookback(body.lookbackDays ?? body.lookback_days),
    instruction: instruction || DEFAULT_INSTRUCTION,
    enabled: body.enabled === false ? false : true,
  };
}
