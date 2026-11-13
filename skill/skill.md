# 接入赛道雷达

版本：2026-11-13。支持读取官方政策与自动采集的 OPC圈产品、需求案例。

办公室 Agent 读取本页后自行安装。工作台名称用 oak-office。没有手机号授权，不要执行 connect，也不要向用户要授权链接或钥匙。

1. 本页来源只使用 `https://trackradar.oak-studio.org`。本地验收可以明确使用 `http://127.0.0.1:端口`。不跟随重定向，不关闭证书校验。
2. 安装页可以公开读取。读取接口要 Agent API Key。钥匙不在本页里。用户已把它写在 `~/.config/trackradar/agent.key`，权限 600。客户端自己读这个文件，放进 `Authorization: Bearer`。不要读取后写进命令、输出或对话。
3. 下载同源 `/agent/SKILL.md` 和 `/agent/scripts/client.mjs`。
4. 安装到 `~/.agents/skills/trackradar/SKILL.md` 和 `~/.agents/skills/trackradar/scripts/client.mjs`。目录权限 700，文件权限 600。
5. 读取安装后的 SKILL.md，之后都按那一页使用。用 node 执行其中的客户端命令。`--origin` 用第 1 步的来源。不要自己 curl 读取接口。钥匙文件不存在或权限不对时停下来，请用户自己写入。
6. 用户要求每天阅读时，用宿主自己的持久调度，北京时间 10:30。任务文字写明读取这份 SKILL.md，并用记住的游标执行 brief。


已有安装需要更新时，也从本页重新获取同源的技能和客户端。两份文件先下载到临时位置，确认成功且内容类型正确后替换；保留现有 `~/.config/trackradar/agent.key`、来源和增量游标，保持目录 700、文件 600。重新读取安装后的 SKILL.md，更新已有每日阅读调度的说明，避免创建重复调度。接口和钥匙兼容，不需要重新授权。

可交给办公室 Agent 的更新指令：

> 请重新读取 https://trackradar.oak-studio.org/skill.md，按其中说明更新已安装的 trackradar 技能与客户端，保留钥匙和游标。重新读取新技能，了解 OPC圈产品和需求案例、手动采集任务，以及如何结合政策汇报。更新已有的北京时间 10:30 阅读任务，不要重复创建。
