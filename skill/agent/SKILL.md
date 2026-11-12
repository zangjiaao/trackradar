---
name: trackradar
description: 当用户要安装或阅读赛道雷达、查看新入库的政策和案例，或安排每天阅读时使用。只读已入库线索。没有手机号授权，不要执行 connect。
---

# 赛道雷达

以本文件所在目录为技能根目录。在办公室工作目录执行下面的绝对路径，不要先 cd。客户端自己从当前目录往上找 `.dev.vars`，带上 `CF-Access-Client-Id` 和 `CF-Access-Client-Secret`。不要把这两个值写进命令、输出或对话。`--origin` 用 `https://trackradar.oak-studio.org`。不跟随重定向，不关闭证书校验。没有授权链接，装好后直接读。

```bash
node ~/.agents/skills/trackradar/scripts/client.mjs brief --origin https://trackradar.oak-studio.org
node ~/.agents/skills/trackradar/scripts/client.mjs brief --origin https://trackradar.oak-studio.org --since 游标时间 --after-id 游标编号
node ~/.agents/skills/trackradar/scripts/client.mjs lead --origin https://trackradar.oak-studio.org --id 线索编号
```

不带游标的 brief 返回最新一页，按入库时间从旧到新。把返回的 `cursor.created_at` 和 `cursor.id` 用 remember 记下。下次两个一起作为 `--since` 和 `--after-id` 传入。`items` 为空表示没有新线索，游标保持不变。`has_more` 为 true 时用新游标再取一页。

lead 读一条。没有这条时 `lead` 为 null。

只读政策和案例。不要调用扫描、配置、对话或其他写入接口。

用户要求每天阅读时，用 schedule，`at` 写成 10:30，按北京时间。任务文字写明：读 `~/.agents/skills/trackradar/SKILL.md`，用记住的来源和游标执行 brief，把新政策和案例收成简报，再用 remember 记下新游标。采集在北京时间 10:00，所以阅读放在 10:30。
