-- 回看用来整合政府已经采纳或正在给政府做的产品，方便定 demo，不只是多收补贴通知。
UPDATE prompt_profiles
SET system_prompt = system_prompt || '回看用来整合政府已经采纳、或正在给政府做的产品，方便定 demo，不只是多收补贴通知。新产品新技术目录以附件里的产品条目为情报主体，解读要点出与智能体、知识库、FDE 或软件向数改对得上的政府侧产品和场景。验收公示和入库备案用来看政府在推什么、谁在做。卡片只留这一段解读，奖补和联络人留给对话。定 demo 时优先对照这些产品和场景，不要只按奖补通知选题。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '政府已经采纳') = 0;
