-- 按需用工具：依赖当前清单时再读库，不把一律重拉写成默认步骤。
UPDATE prompt_profiles
SET system_prompt = system_prompt || '按需用工具。回答依赖当前政策或案例时（再评估、结合最新情报建议 demo、刚采完或刚加了案例）再调 list_leads；只有确实要新爬门户时才调 scan_sources。不需要新鲜数据就不要调。别拿会话里更早的工具结果当现状，也别空问确认。猪八戒、Fiverr、小红书、58 仍不爬取。要新加一条案例却没给链接时，才请用户贴标题和原链接。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '按需用工具') = 0
  AND instr(system_prompt, '立刻再调 list_leads') = 0;
