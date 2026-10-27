-- 按 OPC 密度补政策列表信源。已有同等 URL 的不重复插入，并保持启用。
-- 归一化：去掉协议、www、末尾斜杠和 /index.html，便于识别 http/https 与 index 等价页。

UPDATE sources
SET enabled = 1
WHERE id IN ('src_sh_cyfz', 'src_bj_tzgg', 'src_sz_tzgg', 'src_xa_tzgg')
   OR lower(replace(replace(replace(replace(rtrim(list_url, '/'), 'https://', ''), 'http://', ''), 'www.', ''), '/index.html', ''))
      IN (
        'sheitc.sh.gov.cn/cyfz',
        'jxj.beijing.gov.cn/jxdt/tzgg',
        'gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg',
        'gxj.xa.gov.cn/gzdt/tzgg/1.html'
      );

INSERT INTO sources (id, region, name, list_url, adapter, enabled, notes)
SELECT incoming.id, incoming.region, incoming.name, incoming.list_url, incoming.adapter, incoming.enabled, incoming.notes
FROM (
  SELECT 'src_hz_jxj' AS id, '杭州' AS region, '市经信局 · 通知文件' AS name, 'https://jxj.hangzhou.gov.cn/col/col1229252271/index.html' AS list_url, 'generic_list' AS adapter, 1 AS enabled, '通知文件栏目。列表由脚本注入，通用适配器可能只抽到导航。' AS notes
  UNION ALL SELECT 'src_bj_zcwj', '北京', '市经信局 · 政策文件', 'https://jxj.beijing.gov.cn/zwgk/2024zcwj/', 'generic_list', 1, '政策文件栏目。通知公告列表已另有信源。'
  UNION ALL SELECT 'src_wh_tztg', '武汉', '市经信局 · 通知通告', 'https://jxj.wuhan.gov.cn/xwzx_9/tztg/', 'generic_list', 1, 'OPC 密度优先。通知通告列表。'
  UNION ALL SELECT 'src_suzhou_ggl', '苏州', '市工信局 · 公告栏', 'https://gxj.suzhou.gov.cn/szeic/ggl/common_list.shtml', 'generic_list', 1, 'OPC 密度优先。工信局公告栏。'
  UNION ALL SELECT 'src_cd_zwxx', '成都', '市经信局 · 政务信息', 'https://cdjx.chengdu.gov.cn/cdsjxw/c132860/zwxx.shtml', 'generic_list', 1, 'OPC 密度优先。政务信息列表。站点可能返回 412 WAF，仍收录该 URL。'
  UNION ALL SELECT 'src_nb_dsjj', '宁波', '市数据局 · 通知公告', 'https://dsjj.ningbo.gov.cn/col/col1229578992/index.html', 'generic_list', 1, 'OPC 密度优先。算力券细则与供给方公示的栏目（col1229578992）。旧栏目 col1229050879 重复发文，不另收。'
  UNION ALL SELECT 'src_nb_jxj', '宁波', '市经信局 · 通知公告', 'http://jxj.ningbo.gov.cn/col/col1229561613/index.html', 'generic_list', 1, 'OPC 密度优先。制造业与软件申报栏目 col1229561613。人工智能 OPC 社区申报未核到本站单篇，故收栏目。'
  UNION ALL SELECT 'src_yc_bmwj', '银川', '市工信局 · 部门文件', 'https://yinchuan.gov.cn/xxgk/bmxxgkml/sgxj/xxgkml_1893/bmqtwj_1901/', 'generic_list', 1, '市工信局部门文件。银川栏目；扫描宁夏时一并命中。市政府门户信源仍保留。'
  UNION ALL SELECT 'src_nx_gsgg', '宁夏', '自治区工信厅 · 公示公告', 'https://gxt.nx.gov.cn/zwgk/fdzdgknr/glfw/gsgg/', 'generic_list', 1, '公示公告栏目。工信厅门户信源仍保留。'
) AS incoming
WHERE NOT EXISTS (
  SELECT 1
  FROM sources AS existing
  WHERE existing.id = incoming.id
     OR lower(replace(replace(replace(replace(rtrim(existing.list_url, '/'), 'https://', ''), 'http://', ''), 'www.', ''), '/index.html', ''))
      = lower(replace(replace(replace(replace(rtrim(incoming.list_url, '/'), 'https://', ''), 'http://', ''), 'www.', ''), '/index.html', ''))
);

UPDATE prompt_profiles
SET system_prompt = replace(
      system_prompt,
      '政策地域：宁夏、杭州、深圳、西安、北京、上海。',
      '政策地域：武汉、苏州、成都、宁波、宁夏、杭州、深圳、西安、北京、上海。'
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE instr(system_prompt, '政策地域：宁夏、杭州、深圳、西安、北京、上海。') > 0;
