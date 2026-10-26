import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { CollectForm } from "@/components/collect-form";
import { DbFallback } from "@/components/db-fallback";
import { ModelForm } from "@/components/model-form";
import { PageHeader } from "@/components/page-header";
import { PromptEditor } from "@/components/prompt-editor";
import { SourceList } from "@/components/source-list";
import { WEIGHT_LABELS, WEIGHTS } from "@/lib/domain";
import { listSources, listTracks, getActivePrompt } from "@/lib/queries";
import { readCollectConfig, readPublicModel } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const [model, collect, sources, tracks, prompt] = await Promise.all([
      readPublicModel(),
      readCollectConfig(),
      listSources(),
      listTracks(),
      getActivePrompt(),
    ]);
    return (
      <VStack gap={4} maxWidth={960} className="mx-auto w-full">
        <PageHeader
          title="配置"
          description="模型、信源和采集周期会写进对话的系统提示。Agent 按这里的要求分析机会清单，而不是另起一套假设。"
        />
        <Card>
          <VStack gap={3} id="model">
            <Heading level={2}>模型</Heading>
            <ModelForm initial={model} />
          </VStack>
        </Card>
        <Card>
          <VStack gap={3} id="requirements">
            <Heading level={2}>我的要求</Heading>
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
              T01–T10 固定映射。排除汽车、机器人、具身硬件、芯片和服务器制造。
            </Text>
            <Table density="compact" textOverflow="wrap" verticalAlign="top">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>编号</TableHeaderCell>
                  <TableHeaderCell>赛道</TableHeaderCell>
                  <TableHeaderCell>工作室怎么接</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.code}>
                    <TableCell>
                      <Text type="code">{track.code}</Text>
                    </TableCell>
                    <TableCell>{track.name}</TableCell>
                    <TableCell>{track.studio_fit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </VStack>
        </Card>
        <VStack gap={3} id="sources">
          <Heading level={2}>信源</Heading>
          <Text type="supporting" as="p">
            关掉的信源不会出现在启用列表里，对话试抓也会跳过。试抓可以只预览，或写入机会清单。
          </Text>
          <SourceList sources={sources} />
        </VStack>
        <Card>
          <VStack gap={3} id="schedule">
            <Heading level={2}>采集定时</Heading>
            <Text type="supporting" as="p">
              Worker 里仍是两条占位 Cron。这里选择哪一条生效。触发后只往工作记录写一行，不抓站、不自动筛选。完整记录在{" "}
              <Link href="/work">工作</Link>。
            </Text>
            <CollectForm initial={collect} />
          </VStack>
        </Card>
      </VStack>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取配置失败"} />;
  }
}
