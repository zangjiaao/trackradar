import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  try {
    const leads = await listLeads();
    return (
      <div>
        <PageHeader
          title="线索"
          description="每条线索都保留原始链接。种子数据和列表抓取的分数是骨架分，用来比较，不是最终判断。"
        />
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有线索。可以在信源页抓取列表并写入。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题与原链接</TableHead>
                <TableHead>赛道</TableHead>
                <TableHead>地域</TableHead>
                <TableHead>骨架分</TableHead>
                <TableHead>来源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-xl whitespace-normal">
                    <p className="font-medium">{lead.title}</p>
                    <a className="break-all text-primary underline-offset-4 hover:underline" href={lead.url} target="_blank" rel="noreferrer">
                      {lead.url}
                    </a>
                    {lead.summary ? <p className="mt-1 text-xs text-muted-foreground">{lead.summary}</p> : null}
                  </TableCell>
                  <TableCell>{lead.track_code ?? "—"}</TableCell>
                  <TableCell>{lead.region ?? "—"}</TableCell>
                  <TableCell>{lead.score_total ?? "—"}</TableCell>
                  <TableCell>{lead.origin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取线索失败"} />;
  }
}
