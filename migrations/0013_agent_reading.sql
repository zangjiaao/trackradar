-- 政策卡片上的解读必须来自模型读正文。没有密钥时不把套话写入政策页。
UPDATE prompt_profiles
SET system_prompt = system_prompt || '政策卡片上的一段解读必须由模型阅读正文后写成。没有模型密钥时只保留候选，不用套话写入政策页。新闻里只是顺口提到大模型、又没有软件向切口的，不进入政策页。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '不用套话写入政策页') = 0;
