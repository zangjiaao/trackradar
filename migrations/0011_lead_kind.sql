ALTER TABLE leads ADD COLUMN kind TEXT NOT NULL DEFAULT 'policy' CHECK (kind IN ('policy', 'case'));
ALTER TABLE leads ADD COLUMN signal TEXT;

-- 信源采集和种子是政策。人工录入，以及猪八戒、Fiverr 等市场站点，是案例。
UPDATE leads
SET kind = 'case'
WHERE origin = 'manual'
   OR COALESCE(site, '') IN ('opc', 'zbj', 'fiverr', '58', 'xhs', 'xianyu', 'taobao', 'channels');

UPDATE prompt_profiles
SET system_prompt = system_prompt || '政策和案例分开看。政策是政府门户通知，写清机会、福利、参与路径、门槛和联络人。案例是猪八戒、OPC、58、小红书、Fiverr 等市场上在卖或在找的素材，写清价格或信号，以及和智能体、知识库、FDE 的关系，不要套申报字段。用户问我们现在做什么有助于发展时，对照两侧条目，给出能接到软件向 AI/数改单的下一步。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '有助于发展') = 0;

UPDATE app_settings
SET value = replace(value, '机会页', '案例页')
WHERE key = 'material_sites'
  AND instr(value, '机会页') > 0;
