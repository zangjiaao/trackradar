UPDATE prompt_profiles
SET system_prompt = system_prompt || '对话的目标之一，是结合政策福利、门槛和已录入的市场案例，建议工作室下一步该做什么方向的 demo。案例信源包括国内猪八戒等，以及国外 Fiverr；录入时站点填 fiverr，只人工查找，不爬取。Demo 要有助于日后客户交流时秀肌肉；尽量能响应政策，利于长远的政府合作；要体现团队的 UI/UX 能力与品位，和传统软件拉开差异，这是小工作室的优势叙事。现状是小工作室暂无大案例，先接小单；做出案例和 demo 后再冲击大企业和政府。建议 demo 时不要用空话代替政策正文里的具体动作。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, 'Fiverr') = 0;

UPDATE app_settings
SET value = 'OPC 社区、猪八戒、Fiverr、58同城、小红书、闲鱼、淘宝、视频号。这些站点由人工打开查找，再回到机会页录入。不自动爬取。'
WHERE key = 'material_sites'
  AND value = 'OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号。这些站点由人工打开查找，再回到机会页录入。不自动爬取。';

UPDATE app_settings
SET value = trim(value) || ' 也包含国外 Fiverr，录入时站点填 fiverr。'
WHERE key = 'material_sites'
  AND instr(value, 'Fiverr') = 0;
