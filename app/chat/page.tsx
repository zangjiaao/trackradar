import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { ChatPanel } from "@/components/chat-panel";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <VStack gap={2} height="100%" padding={4} className="min-h-0">
      <VStack gap={1}>
        <Heading level={1}>商机研究助手</Heading>
        <Text type="supporting" as="p">
          围绕机会清单和配置做分析。系统提示会带上你的要求、启用信源、采集周期、常用找素材站点和最近机会。在对话里描述一条外部素材，助手可以写入机会清单。没有模型密钥时只提示去配置，不会发起请求。
        </Text>
      </VStack>
      <ChatPanel />
    </VStack>
  );
}
