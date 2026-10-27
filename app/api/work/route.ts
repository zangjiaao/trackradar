import { clearWorkLog } from "@/lib/work-log";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const cleared = await clearWorkLog();
    return Response.json({ cleared });
  } catch (error) {
    const message = error instanceof Error ? error.message : "清空记录失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
