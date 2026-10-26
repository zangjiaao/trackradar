import { ChatPanel } from "@/components/chat-panel";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div>
      <PageHeader
        title="商机研究助手"
        description="流式对话。系统提示词来自当前激活的 prompt_profiles。没有 OPENAI_API_KEY 时只提示配置方式，不会发起模型请求。"
      />
      <ChatPanel />
    </div>
  );
}
