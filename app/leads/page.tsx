import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { listLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  try {
    const leads = await listLeads();
    return (
      <VStack gap={4} maxWidth={1100} className="mx-auto w-full">
        <PageHeader
          title="线索"
          description="每条线索都保留原始链接。种子数据和列表抓取的分数是骨架分，用来比较，不是最终判断。"
        />
        {leads.length === 0 ? (
          <Text type="supporting" as="p">
            还没有线索。可以在信源页抓取列表并写入。
          </Text>
        ) : (
          <Table density="compact" textOverflow="wrap" verticalAlign="top">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>标题与原链接</TableHeaderCell>
                <TableHeaderCell>赛道</TableHeaderCell>
                <TableHeaderCell>地域</TableHeaderCell>
                <TableHeaderCell>骨架分</TableHeaderCell>
                <TableHeaderCell>来源</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <VStack gap={1}>
                      <Text weight="medium">{lead.title}</Text>
                      <Link href={lead.url} target="_blank" rel="noreferrer noopener">
                        {lead.url}
                      </Link>
                      {lead.summary ? (
                        <Text type="supporting" as="p">
                          {lead.summary}
                        </Text>
                      ) : null}
                    </VStack>
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
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取线索失败"} />;
  }
}
