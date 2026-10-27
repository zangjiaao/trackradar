import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { ChatPanel } from "@/components/chat-panel";
import { ScanSourcesButton } from "@/components/scan-sources-button";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <VStack gap={2} height="100%" className="page-column min-h-0">
      <VStack gap={1}>
        <Heading level={1}>商机研究助手</Heading>
        <Text type="supporting" as="p">
          先在配置里放好模型和信源。没有模型密钥时，拉取只采集候选，不把套话写入政策页。对话本身不会请求模型。
        </Text>
        <Text type="supporting" as="p">
          可让我对照政策与案例，给出我们现在做什么有助于发展的建议。
        </Text>
        <Text type="supporting" as="p">
          也可以问下一步做什么方向的 demo：能拿去跟客户秀能力，尽量贴着政策，并看出 UI/UX 品位。工作室现在先接小单，有了案例再冲大企业和政府。
        </Text>
        <ScanSourcesButton />
      </VStack>
      <ChatPanel />
    </VStack>
  );
}
