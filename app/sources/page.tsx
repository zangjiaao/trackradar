import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { SourceActions } from "@/components/source-actions";
import { listJobs, listSources } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  try {
    const [sources, jobs] = await Promise.all([listSources(), listJobs()]);
    return (
      <div>
        <PageHeader
          title="政策信源"
          description="六地种子写在 sources 表。通用适配器读取列表页里的标题和链接。上海产业发展、北京通知公告、深圳工信局、西安工信局的列表在开发时可以抽出条目；门户首页可能只有导航。"
        />
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <article key={source.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {source.region} · {source.name}
                  </p>
                  <a className="break-all text-sm text-primary underline-offset-4 hover:underline" href={source.list_url} target="_blank" rel="noreferrer">
                    {source.list_url}
                  </a>
                  {source.notes ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{source.notes}</p> : null}
                </div>
                <SourceActions sourceId={source.id} />
              </div>
            </article>
          ))}
        </div>
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-medium">最近任务</h2>
          {jobs.length === 0 ? <p className="text-sm text-muted-foreground">还没有抓取或定时记录。</p> : null}
          <ul className="space-y-1 text-sm text-muted-foreground">
            {jobs.map((job) => (
              <li key={job.id}>
                {job.kind} · {job.status} · {job.message}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取信源失败"} />;
  }
}
