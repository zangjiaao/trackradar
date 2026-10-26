import Link from "next/link";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WEIGHT_LABELS, WEIGHTS } from "@/lib/domain";
import { counts, listJobs, listTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const [summary, tracks, jobs] = await Promise.all([counts(), listTracks(), listJobs(5)]);
    return (
      <div>
        <PageHeader
          title="选出更能接到订单的 AI 软件赛道"
          description="工作室做智能体研发、知识库与业务知识治理、FDE 前场部署交接。雷达只映射 T01–T10，不进入汽车、机器人、具身硬件和芯片制造。"
        />
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {[
            ["赛道", summary.tracks, "/tracks"],
            ["线索", summary.leads, "/leads"],
            ["采样", summary.samples, "/samples"],
            ["信源", summary.sources, "/sources"],
          ].map(([label, value, href]) => (
            <Link key={String(href)} href={String(href)} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </Link>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>默认打分权重</CardTitle>
              <CardDescription>竞争分越高表示竞争越低。当前分数是骨架分，用来排序线索，不是调研结论。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {WEIGHT_LABELS.map((item) => (
                <Badge key={item.key} variant="secondary">
                  {item.label} {Math.round(WEIGHTS[item.key] * 100)}%
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>定时任务</CardTitle>
              <CardDescription>每日政策巡检与每周周报仍是占位，触发后只写入 crawl_jobs。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {jobs.length === 0 ? <p className="text-muted-foreground">还没有触发记录。</p> : null}
              {jobs.map((job) => (
                <p key={job.id}>
                  <span className="font-medium">{job.kind}</span>
                  <span className="text-muted-foreground"> · {job.status} · {job.message}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tracks.slice(0, 4).map((track) => (
            <Card key={track.code} size="sm">
              <CardHeader>
                <CardTitle>
                  {track.code} {track.name}
                </CardTitle>
                <CardDescription>{track.summary}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取数据库失败"} />;
  }
}
