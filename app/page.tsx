import { LeadCatalog } from "@/components/lead-catalog";

export const dynamic = "force-dynamic";

export default function PoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<{ track?: string; sort?: string }> | { track?: string; sort?: string };
}) {
  return (
    <LeadCatalog
      kind="policy"
      title="政策"
      description="政府门户拉来的通知。卡片先写我们能接什么、政策福利、参与路径、门槛和联络人。有原文发布日就标「发布」，只有抓取入库日就标「入库」。价值分只显示数字。"
      emptyAll="还没有政策。到对话里从信源拉取，或在任务里执行一次定时任务。"
      emptyTrack="这个赛道还没有政策。"
      base="/"
      reread
      searchParams={searchParams}
    />
  );
}
