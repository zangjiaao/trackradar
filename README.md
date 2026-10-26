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

迁移会创建表并写入 T01–T10、提示词 v1、政策信源种子、两条示例线索和一条示例采样。本地库在 `.wrangler/`，不要提交。

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

主导航只有三块：机会、对话、配置。

| 路径 | 作用 |
| --- | --- |
| `/` | 机会清单。种子、试抓和采样都汇总在这里 |
| `/chat` | 围绕机会和配置的流式对话 |
| `/settings` | 模型、我的要求、赛道词典、信源开关、采集周期 |
| `/leads`、`/samples` | 转到机会清单 |
| `/tracks`、`/sources`、`/prompts` | 转到配置里对应的区块 |
| `POST /api/samples` | `action: "parse"` 预览，或提交 `items` 入库 |
| `POST /api/sources/fetch` | 通用列表抓取 |
| `PATCH /api/sources` | 启用或停用一条信源 |
| `GET/PUT /api/settings` | 读取或保存模型与采集周期。响应不含完整密钥 |
| `PUT /api/prompts` | 更新激活提示词 |
| `GET/POST /api/chat` | 是否已配置密钥 / 流式对话。系统提示附带配置和最近机会 |

## D1 表

迁移在 `migrations/`。

- `tracks`：T01–T10
- `sources`：宁夏 / 银川、杭州（门户 + 滨江）、深圳工信局、西安工信与高新、北京经信局、上海经信委产业发展与业务类
- `keyword_sets`：三平台采样关键词
- `leads`：线索，含原链接和骨架分
- `manual_samples`：粘贴导入的采样
- `prompt_profiles`：提示词 v1
- `crawl_jobs`：手动试抓与 Cron 占位记录
- `app_settings`：配置页保存的模型、采集开关和周期。密钥只存在本地库，接口不回显全文

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

不爬闲鱼、淘宝、视频号全站，不自动私信，不把 Playwright 放进同一个 Worker，不做完整 CRM。
