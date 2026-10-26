import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { SampleImporter } from "@/components/sample-importer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATFORM_LABEL, SIDE_LABEL, type Platform, type Side } from "@/lib/domain";
import { listKeywordSets, listSamples } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  try {
    const [samples, keywords] = await Promise.all([listSamples(), listKeywordSets()]);
    return (
      <div className="flex flex-col gap-8">
        <div>
          <PageHeader
            title="粘贴解析采样"
            description="不做全站爬取。把闲鱼、淘宝或视频号的搜索结果粘贴进来，抽出标题和链接，预览后再写入 manual_samples。"
          />
          <SampleImporter />
        </div>
        <section>
          <h2 className="mb-3 text-lg font-medium">采样关键词</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {keywords.map((set) => (
              <div key={set.id} className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                <p className="font-medium">{set.name}</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{set.keywords}</p>
                <p className="mt-2 text-xs">猜测赛道 {set.track_code ?? "—"}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-medium">已入库采样</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>关键词</TableHead>
                <TableHead>标题与链接</TableHead>
                <TableHead>侧</TableHead>
                <TableHead>价格/信号</TableHead>
                <TableHead>赛道</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => (
                <TableRow key={sample.id}>
                  <TableCell className="whitespace-nowrap text-xs">{sample.sampled_at.slice(0, 16)}</TableCell>
                  <TableCell>{PLATFORM_LABEL[sample.platform as Platform] ?? sample.platform}</TableCell>
                  <TableCell>{sample.keyword ?? "—"}</TableCell>
                  <TableCell className="max-w-sm whitespace-normal">
                    <p>{sample.title}</p>
                    <a className="break-all text-primary underline-offset-4 hover:underline" href={sample.url} target="_blank" rel="noreferrer">
                      {sample.url}
                    </a>
                    {sample.note ? <p className="mt-1 text-xs text-muted-foreground">{sample.note}</p> : null}
                  </TableCell>
                  <TableCell>{sample.side ? (SIDE_LABEL[sample.side as Side] ?? sample.side) : "—"}</TableCell>
                  <TableCell>{sample.price_or_signal ?? "—"}</TableCell>
                  <TableCell>{sample.track_guess ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取采样失败"} />;
  }
}
