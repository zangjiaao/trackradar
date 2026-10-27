ALTER TABLE leads ADD COLUMN studio_angle TEXT;
ALTER TABLE leads ADD COLUMN subsidy_note TEXT;
ALTER TABLE leads ADD COLUMN participation_note TEXT;
ALTER TABLE leads ADD COLUMN who_can_apply TEXT;
ALTER TABLE leads ADD COLUMN contact_note TEXT;
ALTER TABLE leads ADD COLUMN window_note TEXT;

UPDATE prompt_profiles
SET system_prompt = system_prompt || '正文读到了就要写清五件事：我们有什么机会（结合工作室的智能体、知识库、FDE 和软件交付，具体到这条能接的动作）；政策福利（奖补比例、上限、覆盖的费用和地域）；如何参与（入库、签合同、申报系统、线下报送）；门槛（谁能报、完成时点、信用、是否重复资助、服务商是否要入资源池）；联络人、电话、系统或附件。没有的项留空。不要写「与某赛道相关」，不要复述标题，不要用「做个 demo」代替正文里的动作。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE is_active = 1
  AND instr(system_prompt, '我们有什么机会') = 0;
