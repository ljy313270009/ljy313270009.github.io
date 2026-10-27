---
title: 自建 Telegram RSS 机器人：RSStT 部署与使用完整指南
categories:
  - 自建服务
  - 效率工具
tags:
  - RSS
  - Telegram
  - 自建服务
  - Docker
  - 开源项目
description: 从零部署开源项目 RSStT（RSS to Telegram Bot）：准备 Bot Token、管理员 ID 与 Telegraph Token，用 Docker Compose 起服务，详解必填与常用环境变量、全部订阅命令、订阅设置项，以及常见踩坑与维护要点。
abbrlink: 2f6bc904
date: 2026-10-27 17:00:00
---

RSS 至今仍是获取信息最干净的方式：没有算法推荐、没有信息流广告、更新可控。但 RSS 阅读器通常需要主动打开，而真正高频的场景是——**更新发生时就推送到你天天在用的地方**。

[RSStT（RSS to Telegram Bot）](https://github.com/Rongronggg9/RSS-to-Telegram-Bot) 就是干这个的：把 RSS 订阅源的更新推送到 Telegram，并且作者把它定位成**关心阅读体验**的 RSS 机器人。它不是简单地丢一个链接过来，而是把富文本、图片视频、长图、超长文章这些最容易出问题的地方都做了处理。

先给它一个客观定位，方便判断是否值得折腾：项目创建于 2020 年 8 月，Python 编写，**Star 约 2.1k**、Fork 约 367、采用 AGPLv3 许可。最后一个正式版本是 **v2.10.0（2025-03）**，但 `dev` 分支到 2026 年 10 月仍有提交。

{% note warning %}
**项目现状需要提前知道**：作者已于 2026 年 4 月公开发帖招募新维护者（issue #747），表示自己转向 Linux 内核开发、无暇继续维护，希望项目转为社区驱动。这意味着：**稳定版可能长期停更，功能修复主要落在 dev 分支**。部署时建议直接用 dev 镜像，同时做好配置与数据的自行备份。
{% endnote %}

> **边界说明**：本文是对开源项目部署与使用方式的整理，仅供学习参考。软件可用性取决于上游项目状态与你自己的运行环境，**不对其稳定性、安全性或持续维护做任何保证**。使用 Telegram 相关服务需确保你具备相应的网络访问条件，并遵守所在地的法律法规。

<!-- more -->

## 一、它和普通 RSS 推送机器人差在哪

多数 RSS 机器人只做一件事：抓到更新 → 发一条带链接的消息。RSStT 的区别在于它把力气花在了**消息长什么样**上：

| 能力 | 说明 |
|---|---|
| 富文本保留 | 正文的标题层级、加粗、链接等格式尽量原样保留 |
| 媒体处理 | 正文与 enclosure 里的图片、视频、音频、文档都能带出，可开关 |
| 长图保护 | 长图会以文件形式发送，避免 Telegram 压缩后糊得没法看 |
| 超长文章 | 超过限制的正文自动走 Telegraph 生成即时页面，也可强制只用 Telegram 消息 |
| 自动拆分 | 太长的消息自动拆成多条，避免被截断 |
| emoji 处理 | 自动把 emoji 短代码、图片形式的 emoji 转成真正的 emoji 或文字描述 |
| 冗余清理 | 过滤掉影响阅读的小图标；源标题若是自动填充的则自动省略 |
| OPML | 支持导入导出，且保留自定义标题，便于迁移 |
| 多用户 | 可多人使用同一个实例，管理员可限制订阅数量 |
| 独立代理 | 连接 Telegram 的代理与抓取 RSS 的代理可分别设置 |
| HTTP 缓存 | 减少重复拉取，降低源站压力 |

一句话概括它的设计取向：**推送只是起点，送到手上的那条消息好不好读才是重点**。

## 二、部署前：先备好三样东西

无论用哪种方式部署，下面三项配置都绕不开，建议先全部拿到手再动手。

**1. Bot Token（环境变量 `TOKEN`）**

找 [@BotFather](https://t.me/BotFather)，发送 `/newbot`，按提示创建机器人，得到形如 `1234567890:A1BC...` 的 token。

创建完别急着走，再发一次 `/setinline` 选择你的机器人，设置一个 inline 模式的占位提示语（比如 `请输入命令以继续…`）。**这一步容易漏**，不做的话部分交互（在频道/群组里点按钮跳转私聊）会不正常。

**2. 管理员 ID（环境变量 `MANAGER`）**

找 [@userinfobot](https://t.me/userinfobot) 发任意消息，拿到自己的数字 ID。这一项决定**谁是这个实例的管理员**。多人管理用分号分隔：

```
MANAGER=1234567890;987654321
```

**3. Telegraph Token（环境变量 `TELEGRAPH_TOKEN`）**

Telegraph 用来承载超长正文。访问官方的 [创建账号接口](https://api.telegra.ph/createAccount?short_name=RSStT&author_name=Generated%20by%20RSStT&author_url=https%3A%2F%2Fgithub.com%2FRongronggg9%2FRSS-to-Telegram-Bot) 即可拿到 token。

{% note info %}
**两个细节**：①**每获取一个新 token 都要刷新一次页面**，否则拿到的可能是同一个；②订阅数量多的话**至少准备 5 个 token**，RSStT 会在它们之间轮换使用，token 不够会直接影响长文推送。
{% endnote %}

如果不需要 Telegraph 长文能力，把配置里 `TELEGRAPH_TOKEN` 这一段整体注释掉即可停用。

## 三、四种部署方式怎么选

| 方式 | 适合人群 | 说明 |
|---|---|---|
| **Docker Compose** | 绝大多数人（推荐） | 一台 x86_64 或 arm64 的 VPS 即可，隔离干净、升级方便 |
| **Railway** | 不想管服务器的人 | 一键部署模板，但 Railway 已取消免费方案，约 $5/月起 |
| **pip 安装（PyPI）** | 已有 Python 环境 | `pip install rsstt`，配置目录默认 `~/.rsstt` |
| **源码运行** | 开发者 | 直接跑 `telegramRSSbot.py`，可改代码（注意 AGPL 要求） |

如果只是在自己机器上长期稳定地跑，**Docker Compose 是最省心的选择**；Railway 的便利性要每月付费换，而且有个容易踩的坑（见第九节）。

源码与 pip 方式对 Python 版本有要求：最低 3.9，推荐 3.12；内存最低 128MB、推荐 384MB 以上。若要用 HTML 表格转图片功能（`TABLE_TO_IMAGE=1`），还需装中文字体（Debian/Ubuntu 下 `apt install fonts-wqy-microhei`）。

## 四、Docker Compose 实操步骤

**第一步，取配置模板并填写：**

```sh
mkdir rsstt
cd rsstt
wget https://raw.githubusercontent.com/Rongronggg9/RSS-to-Telegram-Bot/dev/docker-compose.yml.sample -O docker-compose.yml
vi docker-compose.yml   # 填入上一步拿到的三项配置
docker-compose up -d
```

模板里的关键字段长这样，需要改动的就是 `TOKEN`、`MANAGER`、`TELEGRAPH_TOKEN` 三处：

```yaml
services:
  main:
    image: rongronggg9/rss-to-telegram:dev   # 稳定版镜像去掉 :dev 后缀
    container_name: rsstt
    restart: unless-stopped
    volumes:
      - ./config:/app/config                 # 数据落在这里，备份就备份它
    environment:
      - TOKEN=1234567890:A1BCd2EF3gH45IJK6lMN7oPqr8ST9UvWX0Yz0
      - MANAGER=1234567890
      - TELEGRAPH_TOKEN=your_telegraph_tokens_here
```

**第二步，确认起来了：**

```sh
docker-compose logs -f
```

看到 bot 正常连上 Telegram、没有报 token 错误，就可以去私聊你的机器人发 `/start` 测试。

**后续升级**非常简单：

```sh
docker-compose down
docker-compose pull
docker-compose up -d
```

{% note warning %}
**关于镜像标签**：`rongronggg9/rss-to-telegram:dev` 跟踪 dev 分支（更新及时，与当前维护状态匹配）；不带后缀的 `rongronggg9/rss-to-telegram` 是稳定版，但最后一次发版是 2025 年 3 月。鉴于作者已停止维护，**建议用 dev 镜像**，代价是偶尔可能遇到未打磨的改动。
{% endnote %}

## 五、环境变量怎么填

必填项只有三个，其余都有默认值。下面这些是实践中比较容易用到的：

| 变量 | 作用 | 备注 |
|---|---|---|
| `TOKEN` | Telegram Bot Token | 必填 |
| `MANAGER` | 管理员 ID | 必填，多个用分号分隔 |
| `TELEGRAPH_TOKEN` | Telegraph 访问令牌 | 建议 ≥5 个；注释掉即停用 Telegraph |
| `MULTIUSER` | 是否允许多用户 | 默认 `1`；只给自己用可设 `0` |
| `DATABASE_URL` | 数据库连接串 | 默认 SQLite；生产环境建议 `postgres://...` |
| `T_PROXY` | 连接 Telegram API 的代理 | 如 `socks5://172.17.0.1:1080` |
| `R_PROXY` | 抓取 RSS 源的代理 | 与 Telegram 代理分开设置 |
| `PROXY_BYPASS_PRIVATE` | 代理是否绕过内网地址 | 默认 `0` |
| `HTTP_TIMEOUT` | 抓取超时（秒） | 默认 `12`，源站慢可调大 |
| `IMG_RELAY_SERVER` | 图片中继服务前缀 | 默认官方中继 |
| `TABLE_TO_IMAGE` | HTML 表格转图片 | 默认 `0`，开启需中文字体 |
| `DEBUG` | 调试日志 | 排错时设 `1`，正常关掉 |

关于代理要特别说明：**`T_PROXY` 和 `R_PROXY` 是分开的**。如果服务器访问 Telegram 需要代理、但抓取的 RSS 源在国内直连更快，就只配 `T_PROXY`；反之只配 `R_PROXY`。两个都配、都走代理是最慢的组合。

## 六、日常使用：命令速查

配置好之后，直接在私聊里对机器人发命令即可（下列中文说明取自项目官方简体中文语言包）：

| 命令 | 作用 |
|---|---|
| `/sub` | 添加订阅 |
| `/unsub` | 退订订阅 |
| `/unsub_all` | 退订所有订阅 |
| `/list` | 列出订阅列表 |
| `/set` | 自定义某个订阅的设置 |
| `/set_default` | 自定义默认设置（新订阅自动继承） |
| `/import` | 从 OPML 导入订阅 |
| `/export` | 导出订阅到 OPML |
| `/activate_subs` | 启用订阅 |
| `/deactivate_subs` | 停用订阅 |
| `/version` | 查看 bot 版本 |
| `/lang` | 选择语言 |
| `/help` | 查看帮助 |
| `/test` | 测试（仅 bot 管理员） |
| `/set_option` | 更改 bot 配置（仅 bot 管理员） |
| `/user_info` | 查看/修改用户信息（仅 bot 管理员） |

订阅支持批量：

```
/sub https://example.com/feed.xml https://another.com/rss
```

**在频道或群组里使用**有两种方式：

1. 把 bot 加进频道/群组，直接在里面发命令；
2. 在与 bot 的私聊里指定目标：`/sub @username https://example.com/feed`，或用频道 ID `/sub -10010000000000 https://example.com/feed`（ID 必须以 `-100` 开头）。

另外三个高频的快捷设置命令：

- `/set_title 订阅编号 标题` —— 改自定义标题，省略标题则清除
- `/set_interval 订阅编号 分钟数` —— 改该订阅的检查间隔
- `/set_hashtags 订阅编号 #标签1 #标签2` —— 给该订阅加 hashtag，不填则清除

## 七、订阅设置项详解（`/set`）

`/set` 是这个项目最能体现“关心阅读体验”的地方，逐项说明：

| 设置项 | 可选值 | 建议 |
|---|---|---|
| **发送方式** | 自动 / 强制 Telegraph / 强制 Telegram 消息 / 仅标题和来源 | 默认“自动”即可 |
| **长度限制** | 无限制或指定长度 | 仅在“自动”模式下生效，超限则转 Telegraph |
| **链接预览** | 禁用 / 自动 / 启用 | 想要清爽就用“禁用” |
| **媒体** | 禁用 / 启用 / 仅媒体无正文 | 图片类源建议“启用” |
| **作者** | 禁用 / 自动 / 启用 | “自动”会在源确实提供作者时显示 |
| **来源** | 6 档，从完全禁用到源标题+链接 | 影响消息末尾的来源署名形式 |
| **文章标题** | 禁用 / 自动 / 启用 | “自动”可避免重复显示与正文雷同的标题 |
| **条目 hashtag** | 禁用 / 启用 | 是否带上源里自带的标签 |
| **检查间隔** | 分钟 | 重要源可缩短，冷源可拉长 |
| **通知** | 正常 / 静音 | 静音后推送不带提示音 |
| **状态** | 启用 / 停用 | 停用即暂停监控，不退订 |

如果多数订阅想要一样的效果，用 `/set_default` 设一次默认值，新订阅会自动继承，比逐个改省事得多。

## 八、进阶用法

**OPML 迁移**：老阅读器里的订阅可以导出成 `.opml` 文件，发给 bot 用 `/import` 导入；换机器时用 `/export` 导出即可。导入时可以选择保留或清除原有的自定义标题。

**多人与配额**：默认 `MULTIUSER=1` 允许他人使用。管理员可用 `/user_info` 查看某个用户的订阅数、在线状态，并用订阅上限限制其数量；`/set_option` 可以在运行时修改 bot 的部分配置，不用重启容器。

**预览效果**：不确定某个源推出来长什么样，管理员可用 `/test RSS_URL` 先拉一条看看，避免订阅后刷屏一堆版式糟糕的消息。

## 九、常见踩坑清单

- **Telegraph token 不够**：订阅多却只配了一个 token，长文推送会失败。至少 5 个，且每个都要刷新页面后再取。
- **Railway 部署丢失数据**：用一键模板部署后，**必须确认日志里显示使用的是 PostgreSQL**，否则默认 SQLite 会在更新时被清空。手动部署时记得自行添加 Postgres 插件。
- **代理没分开配**：服务器能连 Telegram 但 RSS 源在境外时，只配 `T_PROXY` 反而更快，全走代理只会增加延迟。
- **订阅被自动停用**：某个源连续检查失败 100 次后，RSStT 会自动停用该订阅并通知你。源修好后用 `/activate_subs` 恢复，不要直接删掉重订（会丢失自定义设置）。
- **长图被当成文件发送**：这是特性不是 bug，为的是避免 Telegram 压缩导致看不清。
- **忘记给 bot 开 inline 模式**：`/setinline` 没设置的话，频道/群组里的部分按钮交互会异常。
- **改了代码却没开源**：项目是 AGPLv3，**闭源分发或闭源托管 bot 是被明确禁止的**；改过代码并提供给他人使用时，必须公开源码。

## 十、维护与备份

需要备份的核心只有两样：**配置文件**（Docker 方式下就是 `./config` 目录）和**数据库**（SQLite 落在该目录内；Postgres 需单独备份）。

日常升级就是第四节那三条命令。由于项目处于维护者空缺期，建议：

1. 不要第一时间追最新 dev 镜像，先观察一周社区反馈；
2. 保留一份可用的配置备份，出问题能快速回滚；
3. 如果严重依赖它，考虑 fork 一份到自己账号，避免上游仓库变动带来的不确定性。

## 小结

RSStT 把 RSS 推送这件事做到了“能长期用”的程度——媒体、长图、超长正文、冗余清理这些细节都有人处理过，而不是简单地丢个链接。部署门槛也不高：一台小 VPS、三个配置项、三条 docker 命令就能跑起来。

需要权衡的是**项目维护状态**：作者已公开寻找新维护者，稳定版停更近两年，dev 分支仍在动。自用场景下完全够用，但如果是要长期依赖的服务，就该按“上游可能随时停滞”的前提来做备份和版本策略。

{% note danger %}
**免责声明**：本文仅是对开源项目部署与使用方式的学习性整理，**不构成对该软件可用性、安全性、合法性或持续维护的任何保证**，也不构成任何形式的使用建议。开源项目状态可能随时变化，请以项目仓库的官方说明为准。使用 Telegram 及相关网络服务，请确保遵守所在地的法律法规。任何部署与使用行为及其后果，由操作者自行承担。
{% endnote %}
