INSERT INTO tracks (code, name, summary, studio_fit, sort_order) VALUES
  ('T01', '企业知识库/RAG', '把企业文档、制度、项目经验做成可引用的问答与检索。', '知识库与业务知识治理是工作室主业，可直接做可演示的入库与问答。', 1),
  ('T02', '业务智能体/Agent', '围绕一个业务岗位做能调用工具、留下过程的软件智能体。', '智能体研发是工作室主业，适合用真实工单或知识库做 demo。', 2),
  ('T03', 'FDE驻场交付', '前场部署、联调、培训和上线交接，而不是只交一个账号。', 'FDE 部署交接是工作室交付方式，适合作为其他赛道的成交切口。', 3),
  ('T04', 'OPC/一人公司工具链', '给个体经营者和小团队的轻量经营、内容与客户工具。', '可以用现有智能体能力做窄工具，但订单通常更碎。', 4),
  ('T05', '模型券/算力券落地', '帮企业把地方模型券、算力券真正用到可验收的软件场景。', '工作室不做算力硬件，只做券对应的软件落地与材料。', 5),
  ('T06', '行业大模型应用', '在一个行业场景里把通用模型收成可交付的软件应用。', '适合选一个已有知识库或流程的行业，而不是自训底座模型。', 6),
  ('T07', '数据标注/语料治理', '语料清洗、口径整理、评测集，而不是纯人力标注外包。', '与知识治理相邻，可强调口径和评测，不接纯众包标注。', 7),
  ('T08', '政务/园区场景智能体', '面向政务服务或园区运营的软件智能体与知识助手。', '政策窗口明显，交付仍应落在软件与知识库，不碰硬件集成。', 8),
  ('T09', '中小企业数改（软件）', '中小企业数字化改造里的软件部分：知识、流程、客服与内部助手。', '订单面广，demo 要用一个具体岗位流程，而不是泛数字化。', 9),
  ('T10', '服务商资源池/入库', '进入各地人工智能、软件服务商名录或资源池，换取后续被点选的资格。', '本身不是产品，但是接单入口；材料可以复用工作室三类能力。', 10);

INSERT INTO prompt_profiles (id, version, name, system_prompt, weights_json, is_active, updated_at) VALUES (
  'prompt_v1',
  'v1',
  '商机研究助手 v1',
  '你是工作室的商机研究助手。目标：用可量化证据，尽快选出更能接到订单的 AI 软件赛道，并建议 demo 与宣传切口。工作室能力：智能体研发；知识库与业务知识治理；FDE 部署交接。赛道仅映射 T01–T10。不做汽车/机器人等硬件。政策地域：宁夏、杭州、深圳、西安、北京、上海。每条保留原链接；映射赛道并按默认权重打分；周报含 Top3、demo 选题、开店话术。三平台周采样估计供需，不假设全站爬取。',
  '{"capability":0.25,"funding_window":0.2,"demand_density":0.2,"policy_heat":0.15,"competition":0.1,"demo_feasibility":0.1}',
  1,
  '2026-10-26T00:00:00.000Z'
);

INSERT INTO sources (id, region, name, list_url, adapter, enabled, notes) VALUES
  ('src_sh_cyfz', '上海', '市经信委 · 产业发展', 'https://www.sheitc.sh.gov.cn/cyfz/index.html', 'generic_list', 1, '列表页含标题锚点，通用适配器可抽条目。'),
  ('src_sh_ywl', '上海', '市经信委 · 业务类', 'https://www.sheitc.sh.gov.cn/ywl/index.html', 'generic_list', 1, '列表页含标题锚点，通用适配器可抽条目。'),
  ('src_bj_tzgg', '北京', '市经信局 · 通知公告', 'https://jxj.beijing.gov.cn/jxdt/tzgg/index.html', 'generic_list', 1, '列表页含标题锚点，通用适配器可抽条目。'),
  ('src_bj_ai', '北京', '市经信局 · 人工智能产业相关政策', 'https://jxj.beijing.gov.cn/ztzl/ywzt/hbjh/hbdt/zcwj/rgznzc/', 'generic_list', 1, 'AI 专题列表。'),
  ('src_sz_tzgg', '深圳', '市工信局 · 通知公告', 'http://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg', 'generic_list', 1, '列表页含标题锚点。站点对 HTTPS 不稳定，种子使用 HTTP 列表。'),
  ('src_xa_tzgg', '西安', '市工信局 · 通知公告', 'https://gxj.xa.gov.cn/gzdt/tzgg/1.html', 'generic_list', 1, '列表页含标题锚点。'),
  ('src_xa_gx', '西安', '高新区门户', 'https://xdz.xa.gov.cn/', 'generic_list', 1, '门户入口。栏目改版后可把 list_url 换成具体公告列表。'),
  ('src_nx_gxt', '宁夏', '自治区工信厅门户', 'https://gxt.nx.gov.cn/', 'generic_list', 1, '门户入口，供后续换成通知公告栏目。'),
  ('src_yc_gov', '宁夏', '银川市人民政府门户', 'https://www.yinchuan.gov.cn/', 'generic_list', 1, '银川入口。栏目 URL 确认后替换。'),
  ('src_hz_bj', '杭州', '滨江区 · 通知信息', 'https://www.hhtz.gov.cn/col/col1487002/index.html', 'generic_list', 1, '栏目页。若正文由脚本注入，适配器可能只抽到导航。'),
  ('src_hz_gov', '杭州', '市人民政府门户', 'https://www.hangzhou.gov.cn/', 'generic_list', 1, '公报与通知的入口。开发环境未能连通该域名，种子仍保留官方门户。'),
  ('src_hz_jxj', '杭州', '市经信局 · 通知文件', 'https://jxj.hangzhou.gov.cn/col/col1229252271/index.html', 'generic_list', 1, '通知文件栏目。列表由脚本注入，通用适配器可能只抽到导航。'),
  ('src_bj_zcwj', '北京', '市经信局 · 政策文件', 'https://jxj.beijing.gov.cn/zwgk/2024zcwj/', 'generic_list', 1, '政策文件栏目。通知公告列表已另有信源。'),
  ('src_wh_tztg', '武汉', '市经信局 · 通知通告', 'https://jxj.wuhan.gov.cn/xwzx_9/tztg/', 'generic_list', 1, 'OPC 密度优先。通知通告列表。'),
  ('src_suzhou_ggl', '苏州', '市工信局 · 公告栏', 'https://gxj.suzhou.gov.cn/szeic/ggl/common_list.shtml', 'generic_list', 1, 'OPC 密度优先。工信局公告栏。'),
  ('src_cd_zwxx', '成都', '市经信局 · 政务信息', 'https://cdjx.chengdu.gov.cn/cdsjxw/c132860/zwxx.shtml', 'generic_list', 1, 'OPC 密度优先。政务信息列表。站点可能返回 412 WAF，仍收录该 URL。'),
  ('src_nb_dsjj', '宁波', '市数据局 · 通知公告', 'https://dsjj.ningbo.gov.cn/col/col1229578992/index.html', 'generic_list', 1, 'OPC 密度优先。算力券细则与供给方公示的栏目（col1229578992）。旧栏目 col1229050879 重复发文，不另收。'),
  ('src_nb_jxj', '宁波', '市经信局 · 通知公告', 'http://jxj.ningbo.gov.cn/col/col1229561613/index.html', 'generic_list', 1, 'OPC 密度优先。制造业与软件申报栏目 col1229561613。人工智能 OPC 社区申报未核到本站单篇，故收栏目。'),
  ('src_yc_bmwj', '银川', '市工信局 · 部门文件', 'https://yinchuan.gov.cn/xxgk/bmxxgkml/sgxj/xxgkml_1893/bmqtwj_1901/', 'generic_list', 1, '市工信局部门文件。银川栏目；扫描宁夏时一并命中。市政府门户信源仍保留。'),
  ('src_nx_gsgg', '宁夏', '自治区工信厅 · 公示公告', 'https://gxt.nx.gov.cn/zwgk/fdzdgknr/glfw/gsgg/', 'generic_list', 1, '公示公告栏目。工信厅门户信源仍保留。');

INSERT INTO keyword_sets (id, name, platform, keywords, track_code) VALUES
  ('kw_xy_kb', '闲鱼 · 知识库', 'xianyu', '企业知识库' || char(10) || 'RAG搭建' || char(10) || '文档问答', 'T01'),
  ('kw_tb_agent', '淘宝 · 智能体', 'taobao', '企业智能体定制' || char(10) || 'AI Agent开发', 'T02'),
  ('kw_ch_gov', '视频号 · 政务园区', 'channels', '政务智能体' || char(10) || '园区数字化', 'T08');

INSERT INTO leads (
  id, source_id, track_code, title, url, summary, region,
  score_capability, score_funding, score_demand, score_policy, score_competition, score_demo, score_total, origin
) VALUES
  (
    'lead_seed_sh_ai',
    'src_sh_cyfz',
    'T06',
    '上海市经济和信息化委员会关于印发《上海市加快推动人工智能赋能工业服务业高质量发展行动方案（2027-2028年）》的通知',
    'https://www.sheitc.sh.gov.cn/cyfz/20261023/60be152d6aa74cc7a4f91ce0504c4d82.html',
    '种子线索。分数是骨架分，用来演示原链接和权重，不是结论。',
    '上海',
    74, 48, 50, 82, 55, 64, 62.3,
    'seed'
  ),
  (
    'lead_seed_bj_pool',
    'src_bj_tzgg',
    'T10',
    '北京市经济和信息化局关于组织开展北京市人工智能应用服务商资源池征集工作的通知',
    'https://jxj.beijing.gov.cn/zwgk/2024zcwj/202609/t20260918_4869487.html',
    '种子线索。服务商资源池是入库入口，分数是骨架分。',
    '北京',
    74, 48, 68, 82, 46, 64, 65.0,
    'seed'
  );

INSERT INTO manual_samples (
  id, sampled_at, platform, keyword, title, url, side, price_or_signal, track_guess, note
) VALUES (
  'sample_seed_1',
  '2026-10-26T00:00:00.000Z',
  'xianyu',
  '企业知识库',
  '示例：企业知识库搭建（非真实采样）',
  'https://www.goofish.com/',
  'demand',
  '面议',
  'T01',
  '种子示例，用来展示采样表。真实数据请用粘贴解析导入。'
);
