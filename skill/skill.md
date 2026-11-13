# 接入赛道雷达

办公室 Agent 读取本页后自行安装。工作台名称用 oak-office。没有手机号授权，不要执行 connect，也不要向用户要授权链接或钥匙。

1. 本页来源只使用 `https://trackradar.oak-studio.org`。本地验收可以明确使用 `http://127.0.0.1:端口`。不跟随重定向，不关闭证书校验。
2. 安装页可以公开读取。读取接口要 Agent API Key。钥匙不在本页里。用户已把它写在 `~/.config/trackradar/agent.key`，权限 600。客户端自己读这个文件，放进 `Authorization: Bearer`。不要读取后写进命令、输出或对话。
3. 下载同源 `/agent/SKILL.md` 和 `/agent/scripts/client.mjs`。
4. 安装到 `~/.agents/skills/trackradar/SKILL.md` 和 `~/.agents/skills/trackradar/scripts/client.mjs`。目录权限 700，文件权限 600。
5. 读取安装后的 SKILL.md，之后都按那一页使用。用 node 执行其中的客户端命令。`--origin` 用第 1 步的来源。不要自己 curl 读取接口。钥匙文件不存在或权限不对时停下来，请用户自己写入。
6. 用户要求每天阅读时，用宿主自己的持久调度，北京时间 10:30。任务文字写明读取这份 SKILL.md，并用记住的游标执行 brief。
