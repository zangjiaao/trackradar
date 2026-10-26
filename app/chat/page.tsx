import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { ChatPanel } from "@/components/chat-panel";
import { ScanSourcesButton } from "@/components/scan-sources-button";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <VStack gap={2} height="100%" padding={4} className="min-h-0">
      <VStack gap={1}>
        <Heading level={1}>商机研究助手</Heading>
        <Text type="supporting" as="p">
          先在配置里放好模型和信源。让助手回看已启用信源大约一年，符合赛道的条目会写入机会清单，过程记在任务里。没有模型密钥时，下面的回看仍按本地规则筛选，对话本身不会请求模型。
        </Text>
        <ScanSourcesButton />
      </VStack>
      <ChatPanel />
    </VStack>
  );
}
