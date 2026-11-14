import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { AgentKeysForm } from "@/components/agent-keys-form";
import { DbFallback } from "@/components/db-fallback";
import { MaterialSitesForm } from "@/components/material-sites-form";
import { ModelForm } from "@/components/model-form";
import { PageHeader } from "@/components/page-header";
import { SourceList } from "@/components/source-list";
import { TrackEditor } from "@/components/track-editor";
import { listSources, listTracks } from "@/lib/queries";
import { listAgentKeys } from "@/lib/agent-key";
import { getDb } from "@/lib/db";
import { readMaterialSites, readPublicModel } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const [model, agentKeys, sources, tracks, materialSites] = await Promise.all([
      readPublicModel(),
      listAgentKeys(getDb()).catch(() => []),
      listSources(),
      listTracks(),
      readMaterialSites(),
    ]);
    return (
      <VStack gap={4} className="page-column">
        <PageHeader
          title="配置"
          description="配置采集解读使用的模型、信源、赛道词典和办公室读取钥匙。定时任务与执行记录在任务页。"
        />
        <Card>
          <VStack gap={3} id="agent-keys">
            <Heading level={2}>办公室钥匙</Heading>
            <AgentKeysForm keys={agentKeys} />
            <Text type="supporting" as="p">
              让办公室 Agent 重新读取 <Link href="/skill.md">安装与更新说明</Link>，更新已安装的技能和客户端，即可了解 OPC 案例采集。保留原钥匙和游标，每日阅读安排在北京时间 10:30。
            </Text>
          </VStack>
        </Card>
        <Card>
          <VStack gap={3} id="model">
            <Heading level={2}>模型</Heading>
            <ModelForm initial={model} />
          </VStack>
        </Card>
        <Card>
          <VStack gap={3} id="tracks">
            <Heading level={2}>赛道词典</Heading>
            <Text type="supporting" as="p">
              名称、说明和关键词可改。编号 T01–T10 固定，不能新增或删除。关键词决定回看时打哪些标签，一行一个，留空则用内置词。排除汽车、机器人、具身硬件、芯片和服务器制造。
            </Text>
            <TrackEditor
              tracks={tracks.map((track) => ({
                code: track.code,
                name: track.name,
                summary: track.summary,
                studio_fit: track.studio_fit,
                keywords: track.keywords,
              }))}
            />
          </VStack>
        </Card>
        <Card>
          <VStack gap={3} id="materials">
            <Heading level={2}>常用找素材的站点</Heading>
            <Text type="supporting" as="p">
              记下你常去人工查找的地方。案例补全会读到这段说明。OPC圈广场可通过任务自动采集，其他站点仍由人工录入。
            </Text>
            <MaterialSitesForm initial={materialSites} />
          </VStack>
        </Card>
        <VStack gap={3} id="sources">
          <Heading level={2}>信源</Heading>
          <Text type="supporting" as="p">
            关掉的信源不会被定时任务访问。试抓仍可只预览。写入政策页需要模型读正文；没有密钥时只留下候选。自动回看在{" "}
            <Link href="/tasks">任务页</Link>配置，也可以立即执行。
          </Text>
          <SourceList sources={sources} />
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取配置失败"} />;
  }
}
