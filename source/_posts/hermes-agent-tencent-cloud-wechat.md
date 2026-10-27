---
title: 从零开始：在腾讯云上搭建 Hermes Agent 并接入微信
categories:
  - 自建服务
  - AI
tags:
  - Hermes Agent
  - 腾讯云
  - 微信
  - AI Agent
  - 自建服务
description: 小白向完整教程：注册腾讯云、买轻量应用服务器、控制台重装系统为 Hermes Agent 应用镜像、打开它自带的 Web 后台、在 Channels 里扫码接入微信，并讲清后台远程访问、群消息限制等必须提前知道的事。
abbrlink: 4b8d1e02
date: 2026-10-27 21:00:00
---

[Hermes Agent](https://hermes-agent.nousresearch.com/) 是 Nous Research 开源的自主 AI 智能体，2026 年 2 月发布。它和常见聊天机器人的区别在于：它不是绑在某个 IDE 上的代码助手，而是一个**长期在线、越用越懂你的数字搭档**——有跨会话的持久记忆，会自己沉淀可复用的技能，能定时执行任务，还自带一个**浏览器管理后台**，在后台里就能把它接到微信上。

腾讯云轻量应用服务器是跑它最省事的载体：腾讯云市场已经上架了**官方的 Hermes Agent 应用镜像**，买完服务器在控制台重装系统时直接选它，开机就有一个装好的 Hermes，不用碰命令行。

本文完全按小白视角写，主线就是：**买服务器 → 选 Hermes 镜像 → 打开后台 → 点接入微信 → 扫码**。

{% note danger %}
**必须提前知道的三件事**（不然装完会失望）：

1. **微信接入走腾讯 iLink Bot API**，扫码后运行的是一个 iLink bot 身份（形如 `xxxx@im.bot`），**不是**你的普通个人微信，也**不是**企业微信。
2. **群消息基本收不到**。iLink bot 身份通常无法接收普通微信群的事件，能稳定使用的是**私聊**。这是平台侧限制，改配置解决不了。
3. **它需要花钱**：服务器有月租，模型调用按 token 计费。另外后台能执行系统命令，**远程访问时一定要设认证**，别裸奔在公网上。
{% endnote %}

> **边界说明**：本文是对开源项目与云服务商公开产品的部署流程整理，仅供学习参考，**不构成对任何产品、服务或费用的承诺**。各家价格、镜像上架情况、平台接口可能随时变化，请以官方页面为准。部署和使用 AI 智能体时，请遵守相关平台的服务条款与所在地法律法规。

<!-- more -->

## 一、动手前：先想清楚两件事

**1. 为什么必须用云服务器？**

Hermes 的价值在于「一直在」。你关掉窗口它也应该继续跑，定时任务到点就该执行。自己电脑休眠一次，所有自动化全部断掉。

**2. 大概要花多少？**

| 项目 | 说明 | 成本 |
|---|---|---|
| 云服务器 | 腾讯云轻量应用服务器，2 核 2G 起步 | 几十元/月，新用户有优惠 |
| 大模型 API | Nous Portal / OpenRouter / 各家模型 | 按用量，轻度使用几元到几十元/月 |
| 微信账号 | 一个能扫码的个人微信 | 免费 |

服务器放**国内地域**即可，Hermes 连微信走的是腾讯自己的接口，国内机房延迟更低。

## 二、第一步：注册腾讯云

{% note success %}
**注册入口（点击即可）**

<div align="center" style="margin: 0.8em 0;">
  <a href="https://curl.qcloud.com/lxNLjrln" target="_blank" rel="noopener" style="display:inline-block;padding:0.7em 1.8em;background:#006eff;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">点此注册腾讯云</a>
</div>

<span style="font-size:0.9em;color:#888;">通过该链接注册可享腾讯云新用户专属优惠。注册后记得完成实名认证——买服务器必须要实名。</span>
{% endnote %}

## 三、第二步：买轻量服务器，系统选 Hermes Agent

还没有腾讯云账号？先 [点此注册腾讯云](https://curl.qcloud.com/lxNLjrln)（新用户有专属优惠），并完成实名认证。

进控制台，找到「轻量应用服务器」→「新建」。

**创建时的关键选项**：

| 选项 | 怎么选 | 说明 |
|---|---|---|
| **地域** | 离你近的国内地域 | 连微信更快 |
| **镜像** | 「应用镜像」或「镜像市场」→ 搜索 **Hermes Agent** | 腾讯云市场已上架官方镜像，装好即用 |
| **套餐** | 2 核 2G 起步，**建议 2 核 4G** | 后台 + 常驻任务，内存大一点更从容 |
| **时长** | 先买 1 个月试 | 不合适随时换 |

{% note info %}
**如果创建时没找到这个镜像，或者你已经有一台服务器了**：在实例列表里点进该服务器 →「重装系统」→ 切到「应用镜像 / 镜像市场」→ 搜索 Hermes Agent 重装即可。已有数据会被清空，重装前记得备份。
{% endnote %}

买完记下：**公网 IP**、**用户名**（通常是 `ubuntu` 或 `root`）、**密码**。

## 四、第三步：打开 Hermes 的 Web 后台

开机后 Hermes 已经装好了。它自带一个浏览器管理后台，默认跑在 **9119 端口**。云服务器没有桌面，所以要远程打开它——**推荐用下面第一种方式**。

### 方式一：SSH 隧道（最安全，推荐）

不用开防火墙端口，也不用配登录密码。在你**自己电脑**的终端里执行（Windows 用 PowerShell）：

```bash
ssh -L 9119:127.0.0.1:9119 ubuntu@你的公网IP
```

然后**在你自己电脑的浏览器**里打开：

```text
http://127.0.0.1:9119
```

就能看到 Hermes 后台了。因为走的是本地回环，后台默认不要求登录，直接进。

{% note warning %}
**这个 SSH 窗口不能关**。它是隧道本身，关掉后台就打不开了。想长期用，看第七节把它做成常驻服务。
{% endnote %}

### 方式二：公网直接访问（要额外配置）

如果你想在任何地方都能打开后台，就要让后台监听公网：

```bash
hermes dashboard --host 0.0.0.0 --port 9119 --no-open
```

然后浏览器访问 `http://公网IP:9119`。**但这里有个硬性限制**：

{% note danger %}
**一旦绑定到非本地地址（含 `0.0.0.0`），Hermes 会强制开启登录认证**。没配认证方式的话，它**直接拒绝启动**（fail-closed），老版本那种 `--insecure` 跳过认证的写法已经失效。

选一种认证方式配好：

- **账密码**（适合自己用）：在 `~/.hermes/.env` 里设 `HERMES_DASHBOARD_BASIC_AUTH_USERNAME`、`HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH`、`HERMES_DASHBOARD_BASIC_AUTH_SECRET`
- **Nous Portal OAuth**（**公网暴露推荐**）：`hermes setup` 登录后执行 `hermes dashboard register`，拿到 client id 自动写入配置

同时记得在腾讯云**安全组里放行 9119 端口**。另需强调：账密码方式只适合可信网络，公网长期暴露请走 OAuth，并尽量套一层 HTTPS。
{% endnote %}

### 后台长什么样

进去后左侧是功能栏，常用的几个：

| 页面 | 能干什么 |
|---|---|
| **Status** | 总览：Agent 版本、网关状态、活跃会话 |
| **Channels** | **接微信就在这里** |
| **API Keys** | 填模型 API Key、各平台凭据 |
| **Config** | 150+ 配置项的表单化编辑 |
| **Cron** | 定时任务 |
| **Sessions / Logs / Analytics** | 会话记录、日志、用量统计 |

## 五、第四步：在后台接入微信（核心步骤）

1. 左侧点 **Channels**
2. 在渠道列表里找到 **WeChat（微信）**
3. 点 **Configure**，按表单填入微信渠道需要的凭据（密钥类字段是密码框，留空表示保留原值）
4. 点 **Setup guide** 可以跳到该平台的凭据获取说明
5. **扫码**：微信渠道的登录授权要用手机微信扫二维码并在手机上确认
6. 打开 **Enable** 开关启用
7. 点 **Test** 测试连通性
8. 点 **Restart gateway** 重启网关让配置生效
9. 回到 **Status** 页，看 Gateway 一栏里微信是否显示为已连接

{% note warning %}
**两个细节**：

- 凭据会写进 `~/.hermes/.env`，启用状态写进 `config.yaml`，**必须重启网关**才会真正连上，别忘了第 8 步。
- 如果是系统级安装，后台重启网关需要免密 sudo，否则这一步会直接失败。
{% endnote %}

**连上之后，拿出手机给这个 bot 发一条私聊消息**，它应该会回你。

{% note info %}
**发消息的对象是那个 iLink bot 身份**（扫码后出现的新联系人，形如 `xxx@im.bot`），不是你扫码用的微信号。别人要和它对话，也是直接给这个 bot 发消息，不需要再来扫你的二维码。
{% endnote %}

### 命令行方式（后台出问题时用它）

后台和命令行是等价的，命令行这条命令也能完成扫码配对：

```bash
python -c "import pm; pm.sync_venv(['messaging'], explicit=True)"   # 装依赖
hermes gateway setup        # 选 Weixin，终端出二维码，手机扫码
hermes gateway              # 启动网关
```

如果终端里的二维码显示成乱码，用浏览器打开二维码上方打印的那个 URL 扫码，效果一样。

## 六、第五步：给它装上「脑子」（配置模型）

Hermes 本身不含模型。两种方式：

**后台方式**：左侧 **API Keys** → 在 LLM Providers 分组里填入你的模型 API Key（OpenRouter、DeepSeek、Anthropic 等都支持），保存后重启网关。

**命令行方式**（最省事，一次 OAuth 搞定模型加四个工具）：

```bash
hermes setup --portal
```

验证一下能不能正常对话：

```bash
hermes chat -q "你好，说说你现在能用哪些工具。"
```

## 七、第六步：让它 7×24 在线

SSH 一断，后台和网关都会停。用 systemd 托管最稳：

```bash
sudo tee /etc/systemd/system/hermes-gateway.service > /dev/null <<'EOF'
[Unit]
Description=Hermes Agent Gateway
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/home/ubuntu/.local/bin/hermes gateway
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now hermes-gateway
```

常用命令：

```bash
sudo systemctl status hermes-gateway        # 看状态
sudo journalctl -u hermes-gateway -f        # 实时日志
sudo systemctl restart hermes-gateway       # 重启
```

需要长期远程开后台的话，再建一个 dashboard 服务（注意加 `--no-open`，并确认认证已配好）：

```bash
sudo tee /etc/systemd/system/hermes-dashboard.service > /dev/null <<'EOF'
[Unit]
Description=Hermes Web Dashboard
After=network.target

[Service]
Type=simple
User=ubuntu
EnvironmentFile=/home/ubuntu/.hermes/.env
ExecStart=/home/ubuntu/.local/bin/hermes dashboard --host 0.0.0.0 --port 9119 --no-open
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now hermes-dashboard
```

**如果只需要偶尔进后台，别开这个服务**，用第四节的 SSH 隧道就够了，安全性高得多。

## 八、把权限收一收

默认任何人都能给 bot 发私聊并驱动它干活。既然它能执行终端命令，建议设白名单——在后台 **Config** 页或 `~/.hermes/.env` 里设置：

```bash
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=用户ID1,用户ID2
```

用户 ID 从日志里拿（让对方先发一条消息）：

```bash
sudo journalctl -u hermes-gateway -f
```

后台里也有 **Pairing** 页面，可以直接审批或撤销用户，和命令行 `hermes pairing` 等价。

## 九、必看的限制与常见问题

| 现象 | 原因 / 解决办法 |
|---|---|
| **群里 @ 它没反应** | iLink bot 收不到普通微信群事件，平台限制。可用的是私聊 |
| **远程打不开后台** | 走 SSH 隧道最省事；如果用公网访问，确认绑了非本地地址且已配认证，并放行 9119 端口 |
| 提示 `Another local Hermes gateway is already using this Weixin token` | 同一 token 只允许一个实例轮询，停掉其他 gateway |
| 提示 `aiohttp and cryptography are required` | 补跑依赖安装命令，见第五节命令行方式 |
| 过一阵不回消息 / 报 `errcode=-14` | 会话过期，重新扫码配对一次 |
| 定时推送失败，报 `session not ready` | 主动发送依赖 `context_token`，太久没收到对方消息会过期。**让对方先发一条**即可恢复 |
| 终端二维码乱码 | 改用二维码上方打印的 URL 扫码 |
| `hermes: command not found` | 执行 `source ~/.bashrc` 或重开终端 |
| 媒体收发失败 | 确认 `cryptography` 装了，服务器能访问 `novac2c.cdn.weixin.qq.com` |

再强调两个容易忽略的点：**一条 token 只能一个实例**；**API Key 别外泄**，后台和配置文件里都有明文入口。

## 十、成本与安全

每月固定支出是**服务器费用 + 模型 token 费用**。想省钱：先用新用户优惠跑一个月确认能跑起来；定时任务指定便宜的模型，别什么都上旗舰；定期看账单，防止某个失控的循环任务悄悄烧钱。

安全上记住三条：**远程后台必须开认证**；**微信访问设白名单**；**API Key 单独保管**。

## 小结

整条链路其实很短：**买一台便宜的云服务器 → 系统选 Hermes Agent 镜像 → 用 SSH 隧道打开它的 Web 后台 → 在 Channels 里扫码接微信 → 用 systemd 让它常驻**。真正需要花心思的不是安装，而是想清楚「让它帮你干什么」——定时简报、资料归档、信息监控、项目提醒，这些才是它比聊天机器人值钱的地方。

{% note danger %}
**免责声明**：本文仅是对开源项目与云产品公开信息的部署流程整理，**不构成对任何产品可用性、价格、优惠或性能的承诺，也不构成任何投资与使用建议**。云服务商价格与活动、镜像上架情况、第三方平台接口（含微信 iLink）可能随时调整，请以官方页面为准。AI 智能体具备执行命令的能力，请妥善保管 API Key、限制访问权限、为远程后台开启认证，并对由此产生的费用与行为自行负责。使用相关服务请遵守各平台服务条款及所在地法律法规。
{% endnote %}
