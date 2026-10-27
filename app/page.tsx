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
      description="政府门户拉来的通知。卡片用一段话说明政策和对我们有什么用，右上角是价值分。标题打开原文。底部是发布地点，以及发布日或入库日。"
      emptyAll="还没有政策。到对话里从信源拉取，或在任务里执行一次定时任务。"
      emptyTrack="这个赛道还没有政策。"
      base="/"
      reread
      searchParams={searchParams}
    />
  );
}
