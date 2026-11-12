---
name: trackradar
description: 当用户要安装或阅读赛道雷达、查看新入库的政策和案例，或安排每天阅读时使用。只跑已安装的客户端，由它读取钥匙文件并带上认证。不要自己 curl 读取接口，不要执行 connect。
---

# 赛道雷达

只通过已安装的客户端读取已入库的政策和案例。工作目录保持办公室当前目录，不要先 cd。不要自己 curl `trackradar.oak-studio.org`，不要执行 connect，也不要向用户要手机号、授权链接或钥匙。

客户端是 `~/.agents/skills/trackradar/scripts/client.mjs`。它读取 `~/.config/trackradar/agent.key`（权限 600），把内容放进 `Authorization: Bearer`。命令行只写来源和游标。不要打开这个文件，不要把钥匙写进命令、输出或对话。文件不存在、不是普通文件或权限不是 600 时停下来，请用户到赛道雷达配置页创建钥匙并自己写入。

`--origin` 用 `https://trackradar.oak-studio.org`。不跟随重定向，不关闭证书校验。

```bash
node ~/.agents/skills/trackradar/scripts/client.mjs brief --origin https://trackradar.oak-studio.org
node ~/.agents/skills/trackradar/scripts/client.mjs brief --origin https://trackradar.oak-studio.org --since 游标时间 --after-id 游标编号
node ~/.agents/skills/trackradar/scripts/client.mjs lead --origin https://trackradar.oak-studio.org --id 线索编号
```

第一次，或不需要续读时，执行不带游标的 brief。它返回最新一页，按入库时间从旧到新。把返回的 `cursor.created_at` 和 `cursor.id` 用 remember 记下。下次两个一起作为 `--since` 和 `--after-id`。`items` 为空表示没有新线索，游标保持不变。`has_more` 为 true 时用新游标再取一页。

lead 按编号读一条。没有这条时 `lead` 为 null。

只读政策和案例。不要调用扫描、配置、对话或其他写入接口。

用户要求每天阅读时，用 schedule，`at` 写成 10:30，按北京时间。任务文字要自带做法，不要依赖当时的对话：读 `~/.agents/skills/trackradar/SKILL.md`，用记住的来源和游标执行 brief，把新政策和案例收成简报，再用 remember 记下新游标。采集在北京时间 10:00，所以阅读放在 10:30。
