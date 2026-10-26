import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TracksPage() {
  try {
    const tracks = await listTracks();
    return (
      <div>
        <PageHeader
          title="赛道词典 T01–T10"
          description="十条全部保留。排除汽车、机器人、具身智能硬件、芯片与服务器制造。能力匹配看的是工作室现有交付，不是市场热度。"
        />
        <div className="grid gap-3">
          {tracks.map((track) => (
            <Card key={track.code} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge>{track.code}</Badge>
                  {track.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm leading-6 sm:grid-cols-2">
                <p>{track.summary}</p>
                <p className="text-muted-foreground">{track.studio_fit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取赛道失败"} />;
  }
}
