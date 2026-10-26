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

主导航是机会、对话、工作。配置在顶栏右侧入口，不占主栏。

| 路径 | 作用 |
| --- | --- |
| `/` | 机会清单，以及「新增机会 / 素材」表单。Agent 可补全赛道、供需侧、摘要和打分建议后写入清单 |
| `/chat` | 围绕机会和配置的流式对话。助手可用 `add_opportunity` 把人工找到的素材写入清单 |
| `/work` | 工作记录：试抓、定时占位、补全、录入和 Agent 工具调用 |
| `/settings` | 配置：模型、要求、赛道词典、常用找素材站点、信源开关、采集周期 |
| `/leads`、`/samples` | 转到机会清单 |
| `/tracks`、`/sources`、`/prompts` | 转到配置里对应的区块 |
| `POST /api/opportunities` | 把一条人工素材写入机会清单 |
| `POST /api/opportunities/suggest` | 补全赛道、侧、摘要和打分建议。没有密钥时用本地规则 |
| `POST /api/samples` | 旧的粘贴解析接口，保留兼容，不是主路径 |
| `POST /api/sources/fetch` | 通用列表抓取 |
| `PATCH /api/sources` | 启用或停用一条信源 |
| `GET/PUT /api/settings` | 读取或保存模型、采集周期和站点说明。响应不含完整密钥 |
| `PUT /api/prompts` | 更新激活提示词 |
| `GET/POST /api/chat` | 是否已配置密钥 / 流式对话。系统提示附带配置、站点说明和最近机会 |

## D1 表

迁移在 `migrations/`。

- `tracks`：T01–T10
- `sources`：宁夏 / 银川、杭州（门户 + 滨江）、深圳工信局、西安工信与高新、北京经信局、上海经信委产业发展与业务类
- `keyword_sets`：历史采样关键词，不再作为主路径
- `leads`：机会，含原链接、供需侧、站点、地域和骨架分。人工录入的 `origin` 为 `manual`
- `manual_samples`：旧粘贴解析留下的表。主路径不再往这里写
- `prompt_profiles`：提示词 v1
- `crawl_jobs`：工作记录。手动试抓、Cron 占位或跳过、素材补全、录入和对话工具调用
- `app_settings`：配置页保存的模型、采集开关、周期，以及 `material_sites` 站点说明。密钥只存在本地库，接口不回显全文

素材从 OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号等站点人工查找，再在机会页录入，或在对话里让助手写入。这些条目是分析现状的材料。粘贴解析不是主路径。

通用列表适配器读取页面里的 `<a>`，优先用 `title`。上海产业发展、北京通知公告、深圳工信局通知公告、西安工信局通知公告在开发时可以抽出标题和链接。门户首页可能只有导航。

## 打分

能力匹配 25% · 资金/窗口 20% · 需求密度 20% · 政策热度 15% · 竞争（分高表示竞争更低）10% · demo 可行 10%。

页面上的分数是启发式骨架分，用来排序和演示，不是调研结论。

## Cron 占位

`wrangler.jsonc` 里有两条 UTC cron：

- `0 2 * * *`：每天 10:00（北京时间）政策巡检占位
- `0 1 * * 1`：每周一 09:00（北京时间）周报占位

配置页选择每天或每周一，并可以关掉采集。`worker/index.ts` 的 `scheduled` 仍不抓站：符合周期时写 `placeholder`，关闭或不在周期内写 `skipped`。本地可以用 Wrangler 触发：

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+2+*+*+*"
```

端口以 `npm run dev` 或 `npm run start` 的实际输出为准。

## 非目标

不爬 OPC 社区、猪八戒、58同城、小红书、闲鱼、淘宝、视频号，不自动私信，不把 Playwright 放进同一个 Worker，不做完整 CRM。不做以粘贴解析为主的采样流水线。
