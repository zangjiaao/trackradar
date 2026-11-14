# 赛道雷达 TrackRadar

面向 AI 软件工作室的机会监控看板：定时采集官方政策，阅读正文和 PDF 附件，筛选、解读后入库；自动采集 OPC圈广场的产品与需求，也支持人工录入市场案例，供办公室 Agent 结合政策判断赛道、demo 和接单切口。

工作室能力：智能体研发、企业知识库与业务知识治理、FDE 前场部署与上线交接。赛道固定为 T01–T10，不做汽车、机器人、具身智能硬件、芯片或服务器制造。

Next.js App Router 经 [vinext](https://github.com/cloudflare/vinext) 运行在 Cloudflare Workers，D1 存储数据（本地为 SQLite），界面使用 [Astryx Design System](https://astryx.atmeta.com/) 的 neutral 主题。

## 本地开发

环境：Node.js 22+、npm。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run dev
```

开发服务器默认是 <http://localhost:3000>。Vite + vinext 在 workerd 中提供 D1 绑定 `DB`，本地数据库在 `.wrangler/`，不要提交。

```bash
npm test
npm run typecheck
npm run build
npx astryx doctor --built dist
npm run start
```

`start` 使用构建产物中的 Wrangler 配置运行 Worker。本地不需要浏览器绑定或 Cloudflare OAuth 登录即可开发采集功能。

## 模型配置

先在配置页设置模型，或把以下变量写入 `.dev.vars`。配置页保存的值优先。密钥不会由配置接口全文回显。

| 名称 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | 政策相关性评估、政策解读、OPC 案例筛选和案例补全所需的模型密钥。没有密钥时自动采集仅保存候选，案例补全使用本地规则 |
| `OPENAI_BASE_URL` | 可选，兼容 OpenAI Chat Completions 的网关 |
| `OPENAI_MODEL` | 可选，默认 `gpt-4o-mini` |

系统不再提供内置对话、会话管理、Tavily 联网搜索或 Browser Run 网页读取。分析和日常简报由办公室 Agent 负责。

## 采集与看板

1. 在配置页启用信源，配置模型和赛道词典。
2. 在任务页通过「添加任务」弹窗选择政策或 OPC 案例，周期支持每天、每周一或仅手动执行，也可以点「立即执行」。手动执行和定时执行复用同一套采集流程。
3. 列表按回看窗口翻页，采集标题、发布日、来源、正文和通知页 PDF 附件，先保存到候选表。
4. 有模型时按正文评估相关性，过滤低分、无关或口径过宽的内容，再把有价值的解读写入政策页。没有模型时只留候选，不用套话生成政策卡片。
5. 迁移 0022 预置每日 10:00 的 OPC 案例任务，首次回看最近 30 天产品和需求，按现有赛道筛选，按原链接去重。也可人工把市场需求、报价或产品素材录入案例页。办公室 Agent 通过只读接口读取入库的政策和案例。

每轮信源正文读取名额和执行时间都有上限，回看一年不代表单次完整采完一年。执行记录包含采集、评分、低分过滤、解读写入的计数和失败原因。

政策页保留一段工作室解读、价值分、原文标题、地点和日期，可按赛道筛选、价值分或时间排序。浅解读可以重新读取正文。目录类通知以附件里的产品条目为主体，保留名称、研发单位、简介、意向市场和联系方式；验收公示、入库备案也用于观察政府在推什么、谁在做。

案例页保留市场在卖或在找什么、价格或信号，以及与工作室能力的关系。OPC圈广场通过公开 JSON 列表获取产品与需求；猪八戒、Fiverr、58同城、小红书、闲鱼、淘宝、视频号等站点由人工查找录入。需求区包含供给广告，按原文判断供需。模型只保留与现有赛道、智能体、知识库、FDE 或软件数字化相关的条目，作者的价格、阶段和效果自述不视为已验证事实。

OPC 每轮回看配置的时间窗口并去重。分页、模型批次和运行时间有上限，未完成的页码与窗口保存在 `case_sync`，未筛选候选持久保存在 `case_candidates`，后续执行继续处理。未配置模型或模型失败时不会丢弃候选或生成案例；任务开始即写入“执行中”日志，过程中更新进度，结束或异常时更新同一条记录的最终状态。日志显示新增、筛选、过滤、写入、待处理计数和未完成状态。OPC 任务共用采集锁，避免手动和定时重复运行；已存在的人工案例不覆盖。

迁移 0023 保存 OPC 公开列表中的作者 ID、用户名、姓名、简介、地区和平台认证状态，并以稳定用户 ID 关联同作者已采集案例。案例页和 Agent 的 `brief` / `lead` 均包含 `author`、`related_cases`（其他已入库案例，最多最近五条）及 `related_cases_count`（排除当前案例的总数）。主页链接按用户名生成，可能需要在 OPC圈登录。作者简介是自述，平台认证不代表产品效果已核实。同名不同 ID 不合并，未通过筛选的候选与人工案例不加入关联。

已有自动案例在公开列表再次出现时补全作者信息，不重新评分、不改写人工内容或入库时间，不会作为新案例重复进入 Agent 增量简报。缺少作者信息的旧记录保持为空，直到正常窗口内再次采集到；不扩大 30 天范围、不补采作者历史产品。

价值分是标题线索和规则生成的排序起点，不是调研结论；与模型判断的相关性分分别存储。OPC 自动案例只记录模型相关性，价值分暂为空。默认权重：能力匹配 25%、资金/窗口 20%、需求密度 20%、政策热度 15%、竞争 10%（分高表示竞争较低）、demo 可行 10%。

主要信源覆盖武汉、苏州、成都、宁波、宁夏/银川、杭州、深圳、西安、北京、上海。成都政务信息因 412 WAF 暂时停用。浙江集约化栏目在静态页缺少条目时读取页面中的 jpaas 列表接口。

## 页面与接口

主导航为政策、案例、任务、配置，窄屏也保留这四项。政策、案例和任务页在可见时每 5 秒自动更新，回到页面或网络恢复时也会更新；隐藏页面、打开弹窗或填写输入框时暂停自动更新。清空执行记录只清理已结束的记录，保留执行中的记录。

| 路径 | 作用 |
| --- | --- |
| `/` | 政策看板 |
| `/cases` | 市场案例、人工录入 |
| `/tasks` | 定时/手动采集任务列表、执行记录；创建表单在 Dialog 中 |
| `/settings` | 模型、办公室钥匙、赛道词典、信源、素材站点说明 |
| `/policies`、`/leads` | 转到政策 |
| `/work` | 转到任务 |
| `/samples` | 转到案例手动录入 |
| `/tracks`、`/sources` | 转到配置对应区块 |
| `POST /api/scan` | 带 `taskId` 时按任务目标采集政策或 OPC；不带时兼容政策回看 |
| `GET/POST/PATCH/DELETE /api/tasks` | 管理任务；创建支持 `taskType=policy/opc`、`cadence=daily/weekly/manual` |
| `DELETE /api/work` | 清空执行记录；记录在任务页读取 |
| `POST /api/opportunities` | 人工录入案例 |
| `POST /api/opportunities/suggest` | 模型或本地规则补全赛道、摘要和评分建议 |
| `POST /api/opportunities/reread` | 有模型时按正文重写政策解读、移除无关内容；可带 `url` 或 `limit` |
| `POST /api/samples` | 旧粘贴解析接口，保留兼容 |
| `POST /api/sources/fetch` | 信源列表试抓或抓取入库 |
| `PATCH /api/sources` | 启用、停用信源 |
| `GET/PUT /api/settings` | 模型、采集配置和素材站点说明，不回显完整密钥 |
| `PUT /api/tracks` | 修改 T01–T10 名称、说明和关键词，不增删赛道 |
| `GET/POST/DELETE /api/agent-keys` | 创建、列出、作废办公室读取钥匙 |

旧 `/chat`、`/api/chat` 及其会话接口、`/prompts` 和 `/api/prompts` 已移除，返回 404。配置中的旧对话提示词不参与采集解读。

## 办公室读取

安装入口：<https://trackradar.oak-studio.org/skill.md>。配置页创建 Agent API Key，全文只显示一次。用户把钥匙写入办公室机器的 `~/.config/trackradar/agent.key`，权限 600；客户端自行读取文件，通过 `Authorization: Bearer` 认证。钥匙不要进入命令或对话。

| 路径 | 作用 |
| --- | --- |
| `GET /skill.md` | 安装说明 |
| `GET /agent/SKILL.md` | 安装后的技能正文 |
| `GET /agent/scripts/client.mjs` | 读取客户端 |
| `POST /api/radar/brief` | 最新一页，或用 `since`、`after_id` 增量续读 |
| `POST /api/radar/lead` | 按 `id` 读取单条，不存在时 `lead` 为 null |

`brief` 不带游标时返回最新 20 条，`limit` 最多 50，按入库时间从旧到新排列。下次把 `cursor.created_at` 和 `cursor.id` 作为 `since` 和 `after_id` 传回，只取更晚入库的线索。`has_more` 为 true 时继续取下一页；没有新线索时游标不变。已有线索重新解读不会改变入库时间。

已安装 Agent 的更新入口仍为 `/skill.md`：重新下载同源技能和客户端，保留钥匙与增量游标，重新读取 SKILL.md，并更新已有的 10:30 调度说明。无需换 Key。技能版本为 2026-11-13.2；部署新版本后再通知办公室 Agent 更新。

卡片包含来源、类型、标题、原文链接、赛道、地域、发布日、价值分、相关性、解读和政策/案例字段，不返回模型密钥或附件正文全文。同账号 Worker 也可通过 service binding 调用 `RadarApi.brief` 和 `RadarApi.lead`。

域名挂有 Cloudflare Access。若允许办公室直接访问，仅放行安装说明、技能文件、客户端及 `/api/radar` 路径，读取接口仍校验 Agent API Key。配置、扫描和 `/api/agent-keys` 保持在 Access 后面。每天阅读由办公室宿主安排在北京时间 10:30，避开 10:00 的每日采集。

## 定时任务与部署

`wrangler.jsonc` 中的两条 UTC cron：

- `0 2 * * *`：每天北京时间 10:00。
- `0 1 * * 1`：每周一北京时间 09:00。

到点仅运行已启用且周期匹配的任务；`manual` 任务永远不由 Cron 执行，没有到期任务时记录跳过。本地可按实际端口触发：

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+2+*+*+*"
```

首次部署需登录 Cloudflare，创建 D1，并把真实 `database_id` 写入 Wrangler 配置：

```bash
npx wrangler d1 create trackradar
npx wrangler d1 migrations apply trackradar --remote
npx wrangler secret put OPENAI_API_KEY
npm run build
npx astryx doctor --built dist
npm run deploy
```

`workers_dev` 和 `preview_urls` 保持 `false`，避免部署重新开放 `*.workers.dev`。

## 数据与兼容

迁移在 `migrations/`，沿用现有迁移链，不删除历史表或数据。

- `tracks`、`lead_tracks`：固定赛道词典及线索的多对多赛道标签，`leads.track_code` 保留主赛道。
- `sources`：政策信源和启用状态。
- `policy_candidates`：正文及相关性评估，状态为 `raw`、`scored`、`kept`、`dropped`、`interpreted`。
- `leads`：政策和案例共表，`kind` 为 `policy` 或 `case`，包括解读、评分、价格信号和时间字段。
- `opc_authors`：OPC 公开作者资料；`case_candidates.author_id` 关联发布者。
- `case_candidates`、`case_sync`、`collection_locks`：OPC 候选与相关性、分页断点、采集互斥锁。
- `agent_tasks`、`crawl_jobs`：定时/手动任务及执行记录，历史对话工具记录仍可查看。
- `app_settings`：模型、素材站点说明和旧采集配置；历史 Tavily 配置保留但不再读取或编辑。
- `agent_keys`：办公室钥匙的哈希、前缀、创建时间、使用时间和作废状态，不保存明文。
- `manual_samples`、`keyword_sets`：旧采样兼容表。
- `prompt_profiles`、`chat_sessions`、`chat_messages`：历史对话数据保留，应用不再读写，也不提供页面或 API。

## 非目标

不做内置聊天助手、完整 CRM，不自动私信，除 OPC圈公开广场外不自动爬取其他案例平台，不以粘贴解析作为主流程。
