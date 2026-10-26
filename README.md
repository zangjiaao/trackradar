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

## 环境变量

写在 `.dev.vars`，不要写进仓库。

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 对话需要 | 模型密钥。未设置时对话页给出中文提示，不发起请求。配置页保存的密钥优先于这里。 |
| `OPENAI_BASE_URL` | 否 | 兼容 OpenAI Chat Completions 的网关地址。配置页可以覆盖。 |
| `OPENAI_MODEL` | 否 | 默认 `gpt-4o-mini`。配置页可以覆盖。 |

D1 绑定名是 `DB`，不是环境变量。

## 路由

主导航只有四项：机会、对话、任务，以及右侧的配置（模型、提示词、信源、赛道词典）。窄屏也保持这四项在顶栏里，不再收成只剩配置的菜单。

| 路径 | 作用 |
| --- | --- |
| `/` | 机会清单。筛选显示赛道代号和全名，以及条数、近 7 日增减。手动录入用「新增」弹窗 |
| `/chat` | 对话。页宽与机会、任务、配置相同。「从信源拉取近一年机会」按已启用信源回看并写入清单。没有密钥时该按钮仍按本地规则执行 |
| `/tasks` | 定时任务和执行记录。每天或每周一复用同一套回看、筛选、入库 |
| `/work` | 转到任务 |
| `/settings` | 配置：模型、提示词、赛道词典、信源开关、常用找素材站点 |
| `/leads` | 转到机会清单 |
| `/samples` | 转到机会页的手动录入 |
| `/tracks`、`/sources`、`/prompts` | 转到配置里对应的区块 |
| `POST /api/scan` | 按已启用信源回看并写入机会。可带 `taskId` |
| `GET/POST/PATCH/DELETE /api/tasks` | 定时任务 |
| `POST /api/opportunities` | 把一条人工素材写入机会清单 |
| `POST /api/opportunities/suggest` | 补全赛道、侧、摘要和打分建议。没有密钥时用本地规则 |
| `POST /api/samples` | 旧的粘贴解析接口，保留兼容，不是主路径 |
| `POST /api/sources/fetch` | 通用列表抓取 |
| `PATCH /api/sources` | 启用或停用一条信源 |
| `GET/PUT /api/settings` | 读取或保存模型、采集周期和站点说明。响应不含完整密钥 |
| `PUT /api/prompts` | 更新激活提示词 |
| `PUT /api/tracks` | 修改一条 T01–T10 的名称、说明和关键词。不能新增或删除赛道 |
| `GET/POST /api/chat` | 是否已配置密钥 / 流式对话。系统提示附带配置、站点说明和最近机会 |

## D1 表

迁移在 `migrations/`。

- `tracks`：T01–T10。`keywords` 是赛道词典，留空时回看仍用内置词
- `lead_tracks`：机会和赛道的多对多标签。`leads.track_code` 仍是主赛道，用来打分
- `sources`：宁夏 / 银川、杭州（门户 + 滨江）、深圳工信局、西安工信与高新、北京经信局、上海经信委产业发展与业务类
- `keyword_sets`：历史采样关键词，不再作为主路径
- `leads`：机会，含原链接、供需侧、站点、地域、骨架分，以及政策解读用的 `summary`、`relevant_excerpt`、`opportunity_note`。人工录入是 `manual`，信源回看写入是 `agent`
- `manual_samples`：旧粘贴解析留下的表。主路径不再往这里写
- `prompt_profiles`：提示词 v1
- `agent_tasks`：用户添加的每天或每周一任务
- `crawl_jobs`：执行记录。信源回看、定时任务、试抓、补全、录入和对话工具调用。可关联 `task_id`
- `app_settings`：配置页保存的模型、旧的采集开关，以及 `material_sites` 站点说明。密钥只存在本地库，接口不回显全文

主路径是：先在配置里放模型和信源，再在对话或任务里回看这些信源大约一年。政策先解读，只把和工作室能力或 T01–T10 明显相关的条目写入机会清单，并写上摘要解读、相关片段、机会说明和赛道标签。只有中小企业、园区、政务、入库这类过宽词、又没有人工智能或软件切口的，不入库。一条机会可以同时打上多个赛道标签。机会页用 `/?track=T01` 这类地址按赛道看清单，并用条数和近 7 日增减看热度。赛道词典在配置里改，没有单独的赛道页。只读列表页标题，不翻全站。OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号仍由人工查找后录入。粘贴解析不是主路径。

通用列表适配器读取页面里的 `<a>`，优先用 `title`。上海产业发展、北京通知公告、深圳工信局通知公告、西安工信局通知公告在开发时可以抽出标题和链接。门户首页可能只有导航。

## 打分

能力匹配 25% · 资金/窗口 20% · 需求密度 20% · 政策热度 15% · 竞争（分高表示竞争更低）10% · demo 可行 10%。

页面上的分数是启发式骨架分，用来排序和演示，不是调研结论。

## 定时任务

`wrangler.jsonc` 里有两条 UTC cron：

- `0 2 * * *`：每天 10:00（北京时间）
- `0 1 * * 1`：每周一 09:00（北京时间）

任务页添加的每日或每周任务到点后，走和对话相同的回看：读已启用信源列表，留下约一年内能映射赛道的条目，写入机会清单，并记下每个信源。没有到期任务时写一条跳过。本地可以用 Wrangler 触发：

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+2+*+*+*"
```

端口以 `npm run dev` 或 `npm run start` 的实际输出为准。

## 非目标

不爬 OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号，不自动私信，不把 Playwright 放进同一个 Worker，不做完整 CRM。不做以粘贴解析为主的采样流水线。
