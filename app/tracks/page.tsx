import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { listTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TracksPage() {
  try {
    const tracks = await listTracks();
    return (
      <VStack gap={4} maxWidth={960} className="mx-auto w-full">
        <PageHeader
          title="赛道词典 T01–T10"
          description="十条全部保留。排除汽车、机器人、具身智能硬件、芯片与服务器制造。能力匹配看的是工作室现有交付，不是市场热度。"
        />
        <VStack gap={3}>
          {tracks.map((track) => (
            <Card key={track.code}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Text type="code" weight="semibold">
                    {track.code}
                  </Text>
                  <Heading level={2}>{track.name}</Heading>
                </HStack>
                <Grid columns={{ minWidth: 240, max: 2 }} gap={2}>
                  <Text as="p">{track.summary}</Text>
                  <Text type="supporting" as="p">
                    {track.studio_fit}
                  </Text>
                </Grid>
              </VStack>
            </Card>
          ))}
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取赛道失败"} />;
  }
}
