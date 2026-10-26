import { LeadCatalog } from "@/components/lead-catalog";

export const dynamic = "force-dynamic";

export default function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<{ track?: string; sort?: string }> | { track?: string; sort?: string };
}) {
  return (
    <LeadCatalog
      kind="case"
      title="案例"
      description="市场上的接单和需求。卡片写在卖什么或在找什么、价格或信号，以及和智能体、知识库、FDE 的关系。猪八戒、OPC、58、小红书、Fiverr 从「新增」录入，不爬这些站点。"
      emptyAll="还没有案例。点「新增」，把猪八戒、Fiverr 上看到的小单记下来。"
      emptyTrack="这个赛道还没有案例。"
      base="/cases"
      entry
      searchParams={searchParams}
    />
  );
}
