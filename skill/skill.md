# 接入赛道雷达

办公室 Agent 读取本页后自行安装。工作台名称用 oak-office。没有手机号授权，不要执行 connect，也不要向用户要授权链接。

1. 本页来源只使用 `https://trackradar.oak-studio.org`。本地验收可以明确使用 `http://127.0.0.1:端口`。不跟随重定向，不关闭证书校验。
2. 下载同源 `/agent/SKILL.md` 和 `/agent/scripts/client.mjs`。
3. 安装到 `~/.agents/skills/trackradar/SKILL.md` 和 `~/.agents/skills/trackradar/scripts/client.mjs`。目录权限 700，文件权限 600。
4. 读取安装后的 SKILL.md，按里面的命令用 node 自己执行。`--origin` 用第 1 步的来源。
5. 用户要求每天阅读时，用宿主自己的持久调度，北京时间 10:30。任务文字写明读取这份 SKILL.md，并用记住的游标执行 brief。
