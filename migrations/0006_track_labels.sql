ALTER TABLE tracks ADD COLUMN keywords TEXT NOT NULL DEFAULT '';

UPDATE tracks SET keywords = '模型券' || char(10) || '算力券' || char(10) || '算力补贴' WHERE code = 'T05';
UPDATE tracks SET keywords = '政务' || char(10) || '园区' || char(10) || '一网通办' WHERE code = 'T08';
UPDATE tracks SET keywords = '服务商' || char(10) || '资源池' || char(10) || '入库' WHERE code = 'T10';
UPDATE tracks SET keywords = '数据标注' || char(10) || '标注' || char(10) || '语料' WHERE code = 'T07';
UPDATE tracks SET keywords = '驻场' || char(10) || 'FDE' || char(10) || '上线交接' || char(10) || '前场部署' WHERE code = 'T03';
UPDATE tracks SET keywords = '一人公司' || char(10) || 'OPC' WHERE code = 'T04';
UPDATE tracks SET keywords = '数改' || char(10) || '中小企业' || char(10) || '数字化转型' || char(10) || '数字化改造' WHERE code = 'T09';
UPDATE tracks SET keywords = '行业大模型' || char(10) || '行业模型' WHERE code = 'T06';
UPDATE tracks SET keywords = '知识库' || char(10) || 'RAG' || char(10) || 'rag' || char(10) || '知识治理' || char(10) || '文档问答' WHERE code = 'T01';
UPDATE tracks SET keywords = '智能体' || char(10) || 'Agent' || char(10) || 'agent' WHERE code = 'T02';

CREATE TABLE lead_tracks (
  lead_id TEXT NOT NULL,
  track_code TEXT NOT NULL,
  PRIMARY KEY (lead_id, track_code)
);

CREATE INDEX idx_lead_tracks_code ON lead_tracks (track_code);

INSERT INTO lead_tracks (lead_id, track_code)
SELECT id, track_code FROM leads
WHERE track_code GLOB 'T[0-1][0-9]'
  AND length(track_code) = 3;

INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T05' FROM leads WHERE title LIKE '%模型券%' OR title LIKE '%算力券%' OR title LIKE '%算力补贴%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T08' FROM leads WHERE title LIKE '%政务%' OR title LIKE '%园区%' OR title LIKE '%一网通办%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T10' FROM leads WHERE title LIKE '%服务商%' OR title LIKE '%资源池%' OR title LIKE '%入库%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T07' FROM leads WHERE title LIKE '%数据标注%' OR title LIKE '%标注%' OR title LIKE '%语料%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T03' FROM leads WHERE title LIKE '%驻场%' OR title LIKE '%FDE%' OR title LIKE '%上线交接%' OR title LIKE '%前场部署%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T04' FROM leads WHERE title LIKE '%一人公司%' OR title LIKE '%OPC%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T09' FROM leads WHERE title LIKE '%数改%' OR title LIKE '%中小企业%' OR title LIKE '%数字化转型%' OR title LIKE '%数字化改造%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T06' FROM leads WHERE title LIKE '%行业大模型%' OR title LIKE '%行业模型%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T01' FROM leads WHERE title LIKE '%知识库%' OR title LIKE '%RAG%' OR title LIKE '%知识治理%' OR title LIKE '%文档问答%';
INSERT OR IGNORE INTO lead_tracks (lead_id, track_code)
SELECT id, 'T02' FROM leads WHERE title LIKE '%智能体%' OR title LIKE '%Agent%';
