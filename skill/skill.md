# 接入赛道雷达

办公室 Agent 读取本页后自行安装。工作台名称用 oak-office。没有手机号授权，不要执行 connect，也不要向用户要授权链接。

1. 本页来源只使用 `https://trackradar.oak-studio.org`。本地验收可以明确使用 `http://127.0.0.1:端口`。不跟随重定向，不关闭证书校验。
2. 站点在 Cloudflare Access 后面。用办公室 `.dev.vars` 里的 `CF_ACCESS_CLIENT_ID` 和 `CF_ACCESS_CLIENT_SECRET` 作为 `CF-Access-Client-Id` 和 `CF-Access-Client-Secret`。在办公室工作目录执行时，这个文件在上一级。用 node 自己读文件并下载，不要把令牌写进命令、输出或对话。赛道雷达的 Access 策略是 Service Auth，纳入这枚已有的服务令牌。
3. 下载同源 `/agent/SKILL.md` 和 `/agent/scripts/client.mjs`。
4. 安装到 `~/.agents/skills/trackradar/SKILL.md` 和 `~/.agents/skills/trackradar/scripts/client.mjs`。目录权限 700，文件权限 600。
5. 读取安装后的 SKILL.md，按里面的命令用 node 自己执行。`--origin` 用第 1 步的来源。在办公室工作目录执行，不要先 cd 到别处。
6. 用户要求每天阅读时，用宿主自己的持久调度，北京时间 10:30。任务文字写明读取这份 SKILL.md，并用记住的游标执行 brief。
