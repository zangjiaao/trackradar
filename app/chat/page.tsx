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
          流式对话。系统提示词来自当前激活的 prompt_profiles。没有 OPENAI_API_KEY 时只提示配置方式，不会发起模型请求。
        </Text>
      </VStack>
      <ChatPanel />
    </VStack>
  );
}
