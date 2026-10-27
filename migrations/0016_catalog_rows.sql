-- 目录附件按产品行保留名称、单位和场景，不要只写发布了多少项。
UPDATE prompt_profiles
SET system_prompt = system_prompt || '目录附件按产品行保留名称、研发单位、简介、意向市场和联系方式。解读要写出对得上的代表性条目，不要只写发布了多少项。服务器、芯片、周界和纯视觉安防降为背景。详细条目在摘要里，正文保留附件文本。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '代表性条目') = 0;
