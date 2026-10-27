# 赛道雷达 TrackRadar

用可量化证据，尽快选出更能接到订单的 AI 软件赛道，并建议 demo 与宣传切口。

工作室能力：智能体研发；企业知识库与业务知识治理；FDE 前场部署与上线交接。赛道只映射 T01–T10，不做汽车、机器人、具身智能硬件、芯片或服务器制造。

这是可在本地启动的 MVP 骨架：Next.js App Router，经 [vinext](https://github.com/cloudflare/vinext) 跑在 Cloudflare Workers 上，数据用 D1（本地为 SQLite）。界面使用 [Astryx Design System](https://astryx.atmeta.com/)（`@astryxdesign/core`，neutral 主题，Tailwind v4 仅作布局桥接）。

## 环境

- Node.js 22+
- npm

## 启动

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run dev
```

开发服务器默认是 <http://localhost:3000>。`npm run dev` 使用 Vite + vinext，并在 workerd 里提供 D1 绑定 `DB`。

迁移会创建表并写入 T01–T10、提示词 v1、政策信源种子、两条示例线索、一条历史示例采样，以及常用找素材站点说明。本地库在 `.wrangler/`，不要提交。

生产构建后再用 Wrangler 看 Worker：

```bash
npm run build
npm run start
```

部署（需要 Cloudflare 登录，并先把远程 D1 的 `database_id` 写进 `wrangler.jsonc`）：

```bash
npx wrangler d1 create trackradar
npx wrangler d1 migrations apply trackradar --remote
npx wrangler secret put OPENAI_API_KEY
npm run deploy
```

`wrangler.jsonc` 里 `workers_dev` 和 `preview_urls` 都是 `false`。合入并重新部署后，`trackradar.<subdomain>.workers.dev` 以及 Preview/Version 的 `*.workers.dev` 会关掉。只在仪表盘里 Disable 不够，下次 deploy 仍可能把 `workers.dev` 重新打开。

## 环境变量

写在 `.dev.vars`，不要写进仓库。

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 对话需要 | 模型密钥。未设置时对话页给出中文提示，不发起请求。配置页保存的密钥优先于这里。 |
| `OPENAI_BASE_URL` | 否 | 兼容 OpenAI Chat Completions 的网关地址。配置页可以覆盖。 |
| `OPENAI_MODEL` | 否 | 默认 `gpt-4o-mini`。配置页可以覆盖。 |

D1 绑定名是 `DB`，不是环境变量。

## 路由

主导航有五项：政策、案例、对话、任务，以及右侧的配置（模型、提示词、信源、赛道词典）。窄屏也把这五项留在顶栏里，不再收成只剩配置的菜单。

| 路径 | 作用 |
| --- | --- |
| `/` | 政策。卡片是一段解读、右上角价值分、可点的原文标题，以及底部的发布地点和日期。可按价值分或时间排序。浅解读可以重新读正文 |
| `/policies`、`/leads` | 转到政策 |
| `/cases` | 案例。卡片写市场上在卖或在找什么、价格或信号，以及和智能体、知识库、FDE 的关系。手动录入在这里 |
| `/chat` | 对话。页宽与政策、案例、任务、配置相同。顶部一条细栏可以新建、切换和删除会话；消息和未发送草稿按会话存在 D1，关掉标签页后还在。采集一年政策在任务页，对话页不再放这个按钮。可对照政策与案例问现在做什么，或要一个能拿去给客户看的 demo |
| `/tasks` | 定时任务和执行记录。每天或每周一复用同一套回看、筛选、入库 |
| `/work` | 转到任务 |
| `/settings` | 配置：模型、提示词、赛道词典、信源开关、常用找素材站点 |
| `/samples` | 转到案例页的手动录入 |
| `/tracks`、`/sources`、`/prompts` | 转到配置里对应的区块 |
| `POST /api/scan` | 按已启用信源回看并写入政策。可带 `taskId` |
| `GET/POST/PATCH/DELETE /api/tasks` | 定时任务 |
| `POST /api/opportunities` | 把一条人工素材写入案例 |
| `POST /api/opportunities/suggest` | 补全赛道、侧、摘要和打分建议。没有密钥时用本地规则 |
| `POST /api/opportunities/reread` | 有模型时按正文重写解读，无关的从政策页移除。没有密钥时不改。可传 `url` 或 `limit` |
| `POST /api/samples` | 旧的粘贴解析接口，保留兼容，不是主路径 |
| `POST /api/sources/fetch` | 通用列表抓取 |
| `PATCH /api/sources` | 启用或停用一条信源 |
| `GET/PUT /api/settings` | 读取或保存模型、采集周期和站点说明。响应不含完整密钥 |
| `PUT /api/prompts` | 更新激活提示词 |
| `PUT /api/tracks` | 修改一条 T01–T10 的名称、说明和关键词。不能新增或删除赛道 |
| `GET/POST /api/chat` | 是否已配置密钥 / 流式对话。系统提示附带配置、最近政策和最近案例 |
| `GET/POST /api/chat/sessions` | 列出会话 / 新建会话。消息和草稿按会话隔离 |
| `GET/PUT/DELETE /api/chat/sessions/:id` | 读取、保存或删除一个会话。删除时消息一起去掉 |

## D1 表

迁移在 `migrations/`。

- `tracks`：T01–T10。`keywords` 是赛道词典，留空时回看仍用内置词
- `lead_tracks`：机会和赛道的多对多标签。`leads.track_code` 仍是主赛道，用来打分
- `sources`：优先地域武汉、苏州、成都、宁波，以及宁夏 / 银川、杭州（门户、滨江、市经信通知文件）、深圳工信局、西安工信与高新、北京经信局（通知公告与政策文件）、上海经信委产业发展与业务类。成都政务信息因 412 瑞数 WAF 先停用。杭州经信和宁波栏目页的列表由 jpaas 接口补齐。宁波收数据局通知公告（算力券）和经信局通知公告，不收单篇。上海业务类栏目仍在，不另加空的 app 通知公告。
- `keyword_sets`：历史采样关键词，不再作为主路径
- `leads`：政策和案例共用一张表。`kind` 为 `policy` 或 `case`。`signal` 是案例的价格或信号。`published_at` 是原文发布日，没有则卡片用 `created_at` 标「入库」。政策解读用 `studio_angle`、`subsidy_note`、`participation_note`、`who_can_apply`、`contact_note`。人工录入是 `manual` 且 `kind=case`，信源回看写入是 `agent` 且 `kind=policy`。对话的 `list_leads` 读这些解读字段，并带上候选表里的相关性分
- `policy_candidates`：回看候选。`stage` 为 `raw`、`scored`、`kept`、`dropped`、`interpreted`。没有模型时停在 `raw`。模型判定无关的停在 `dropped`。解读写入后 `stage=interpreted` 并连到 `leads`
- `manual_samples`：旧粘贴解析留下的表。主路径不再往这里写
- `prompt_profiles`：提示词 v1
- `agent_tasks`：用户添加的每天或每周一任务
- `crawl_jobs`：执行记录。信源回看、定时任务、试抓、补全、录入和对话工具调用。可关联 `task_id`
- `app_settings`：配置页保存的模型、旧的采集开关，以及 `material_sites` 站点说明。密钥只存在本地库，接口不回显全文
- `chat_sessions`、`chat_messages`：对话页的多会话。`chat_messages.session_id` 对应会话，关掉标签页后仍在。标题取首条用户消息，否则是「新对话」

主路径是：先在配置里放模型和信源，再在对话或任务里回看这些信源大约一年。回看先采集标题、发表时间、出处和正文入库（不因赛道未映射丢掉）。有模型时读正文判断是否与工作室有关，并写一段解读；无关或过宽的不进政策页。没有密钥时只留候选，不用套话写入政策页。执行记录写采集、评了、低分过滤、解读写入。模型评估走和对话相同的聊天接口，不使用结构化输出；失败时这条记录会写上超时或接口状态。`leads.kind` 为 `policy` 或 `case`：信源采集和种子迁成政策，人工录入以及猪八戒、Fiverr 等市场站点迁成案例。一条可以同时打上多个赛道标签。政策页用 `/?track=T01`，案例页用 `/cases?track=T01`，并用条数和近 7 日增减看热度。赛道词典在配置里改，只作提示，不再单独决定丢掉。列表会翻到回看窗口内的后续页，日期取条目旁的发布日，不把文章链接里的长数字当成日期。同试点的验收公示和入库备案优先读正文。通知页上的 PDF 附件会抽文本，附在正文后面交给模型；目录优先保留人工智能、软件、智能体、知识库相关片段，验收名单保留开头。目录类通知以附件里的产品条目为情报主体。摘录按整行保留名称、研发单位、简介、意向市场和联系方式，优先知识库、智能体和软件；服务器、芯片、周界和纯视觉安防只作背景。解读点出两三条对得上的代表性条目，不要只写发布了多少项。卡片仍是一段话，详细条目进摘要，正文保留附件文本。用来定 demo，不只是多收补贴通知。验收公示和入库备案用来看政府在推什么、谁在做。卡片只留这一段解读。预算内再交给模型。OPC 社区、猪八戒、Fiverr、58同城、小红书、闲鱼、淘宝、视频号仍由人工在案例页录入，站点代码里 Fiverr 是 `fiverr`。留下的政策和案例会进入对话：`list_leads` 能看到相关性分和解读字段，用来确定方向和 demo。对话按需用工具：依赖当前政策或案例时再调 `list_leads`，确实要新爬门户时才调 `scan_sources`。不拿会话里的旧工具结果当现状，也不空问确认。这段写在每次都会附上的工具说明里，已保存的提示词由迁移 `0017` 和 `0018` 收成同一句。粘贴解析不是主路径。

通用列表适配器读取页面里的 `<a>`，优先用 `title`，没有则用内部标题节点。上海产业发展、北京通知公告、深圳工信局通知公告、西安工信局通知公告在开发时可以抽出标题和链接。门户首页可能只有导航。浙江集约化栏目如果静态页抽不到条目，会再请求页面里的 jpaas 列表接口。成都政务信息返回 412，信源先停用。

## 打分

能力匹配 25% · 资金/窗口 20% · 需求密度 20% · 政策热度 15% · 竞争（分高表示竞争更低）10% · demo 可行 10%。

页面上的价值分沿用这套权重，按标题线索估算，用来排序，不是调研结论。没有分的卡片写「未评分」。空的供需侧或站点不显示。

## 定时任务

`wrangler.jsonc` 里有两条 UTC cron：

- `0 2 * * *`：每天 10:00（北京时间）
- `0 1 * * 1`：每周一 09:00（北京时间）

任务页添加的每日或每周任务到点后，走和对话相同的四步回看，并记下每个信源的采集、评分、低分过滤和解读写入。没有到期任务时写一条跳过。本地可以用 Wrangler 触发：

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+2+*+*+*"
```

端口以 `npm run dev` 或 `npm run start` 的实际输出为准。

## 非目标

不爬 OPC 社区、猪八戒、Fiverr、58同城、小红书、闲鱼、淘宝、视频号，不自动私信，不把 Playwright 放进同一个 Worker，不做完整 CRM。不做以粘贴解析为主的采样流水线。
