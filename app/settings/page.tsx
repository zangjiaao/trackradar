import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { DbFallback } from "@/components/db-fallback";
import { MaterialSitesForm } from "@/components/material-sites-form";
import { ModelForm } from "@/components/model-form";
import { PageHeader } from "@/components/page-header";
import { PromptEditor } from "@/components/prompt-editor";
import { SourceList } from "@/components/source-list";
import { TrackEditor } from "@/components/track-editor";
import { WEIGHT_LABELS, WEIGHTS } from "@/lib/domain";
import { listSources, listTracks, getActivePrompt } from "@/lib/queries";
import { readMaterialSites, readPublicModel } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const [model, sources, tracks, prompt, materialSites] = await Promise.all([
      readPublicModel(),
      listSources(),
      listTracks(),
      getActivePrompt(),
      readMaterialSites(),
    ]);
    return (
      <VStack gap={4} className="page-column">
        <PageHeader
          title="配置"
          description="先配好模型、提示词和信源。对话和任务都会按这里的要求，到已启用信源回看并写入政策。定时任务在任务页，不在这里。"
        />
        <Card>
          <VStack gap={3} id="model">
            <Heading level={2}>模型</Heading>
            <ModelForm initial={model} />
          </VStack>
        </Card>
        <Card>
          <VStack gap={3} id="requirements">
            <Heading level={2}>提示词</Heading>
            <Text type="supporting" as="p">
              权重：
              {WEIGHT_LABELS.map((item) => `${item.label} ${Math.round(WEIGHTS[item.key] * 100)}%`).join(" · ")}
              。对话会在这段文字后附加工具说明和当前机会，附加内容不会写回这里。
            </Text>
            {prompt ? (
              <PromptEditor initial={prompt.system_prompt} version={prompt.version} />
            ) : (
              <Text type="supporting" as="p">
                没有激活的提示词。请先执行 npm run db:migrate。
              </Text>
            )}
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
              记下你常去人工查找的地方。对话和补全会读到这段说明。应用不会爬这些网站。
            </Text>
            <MaterialSitesForm initial={materialSites} />
          </VStack>
        </Card>
        <VStack gap={3} id="sources">
          <Heading level={2}>信源</Heading>
          <Text type="supporting" as="p">
            关掉的信源不会被对话或定时任务访问。试抓仍可只预览，或写入政策。自动回看在{" "}
            <Link href="/chat">对话</Link>和<Link href="/tasks">任务</Link>。
          </Text>
          <SourceList sources={sources} />
        </VStack>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取配置失败"} />;
  }
}
