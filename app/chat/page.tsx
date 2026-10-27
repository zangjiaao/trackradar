import { VStack } from "@astryxdesign/core/VStack";
import { ChatPanel } from "@/components/chat-panel";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <VStack gap={0} height="100%" className="page-column min-h-0">
      <ChatPanel />
    </VStack>
  );
}
