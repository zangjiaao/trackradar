ALTER TABLE leads ADD COLUMN side TEXT;
ALTER TABLE leads ADD COLUMN site TEXT;

INSERT INTO app_settings (key, value) VALUES (
  'material_sites',
  'OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号。这些站点由人工打开查找，再回到机会页录入。不自动爬取。'
);
