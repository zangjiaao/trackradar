-- 同一数字化转型试点的验收公示和入库备案有情报价值，不要只因是名单就丢掉。
UPDATE prompt_profiles
SET system_prompt = system_prompt || '同一数字化转型试点的验收公示、入库备案和分批申报有情报价值，不要仅因是名单公示就丢掉。体检、租车、表彰等无关公告不进入政策页。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '不要仅因是名单公示就丢掉') = 0;
