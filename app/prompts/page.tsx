import { DbFallback } from "@/components/db-fallback";
import { PageHeader } from "@/components/page-header";
import { PromptEditor } from "@/components/prompt-editor";
import { WEIGHT_LABELS, WEIGHTS } from "@/lib/domain";
import { getActivePrompt } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  try {
    const prompt = await getActivePrompt();
    if (!prompt) return <DbFallback message="没有激活的提示词。" />;
    return (
      <div>
        <PageHeader
          title="提示词配置"
          description={`当前激活 ${prompt.version} ${prompt.name}。对话会在这段文字后附加工具使用说明，附加内容不会写回数据库。`}
        />
        <p className="mb-4 text-sm text-muted-foreground">
          权重：
          {WEIGHT_LABELS.map((item) => `${item.label} ${Math.round(WEIGHTS[item.key] * 100)}%`).join(" · ")}
        </p>
        <PromptEditor initial={prompt.system_prompt} version={prompt.version} />
      </div>
    );
  } catch (error) {
    return <DbFallback message={error instanceof Error ? error.message : "读取提示词失败"} />;
  }
}
