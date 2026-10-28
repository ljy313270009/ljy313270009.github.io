---
title: 从零开始：用 Hexo + GitHub + Cloudflare 搭一个自己的博客
date: 2026-10-21 15:00:00
categories:
  - 技术
  - 自建与部署
tags:
  - Hexo
  - GitHub Actions
  - Cloudflare
  - 建站
description: 写给完全新手的 Hexo 建站记录 —— 从本地搭建、GitHub Actions 自动部署，到 Cloudflare 绑定自有域名上线的全过程，外加一路踩过的坑。
toc: true
abbrlink: 55f5c54d
---

这篇是建站过程的存档，也写给想搭博客却不知道从哪下手的你。

最终效果：**本地写完 Markdown，`git push` 一下，一分钟后全世界都能通过你自己的域名看到。** 整套东西除了域名一年几十块，其余全免费。

<!-- more -->

## 先搞清楚三者各干什么

新手最容易迷失在各种名词里。其实整个链条只有三个角色：

| 角色 | 干什么 | 类比 |
| --- | --- | --- |
| **Hexo** | 把你写的 `.md` 变成静态网页 | 排版印刷厂 |
| **GitHub** | 存文章源文件，并免费托管生成好的网页 | 仓库 + 店面 |
| **Cloudflare** | 让你自己的域名指到 GitHub 上，并负责 HTTPS 加密 | 门牌号 + 保安 |

搞清楚这层关系，后面每一步都不会觉得莫名奇妙。

{% note info %}
为什么不让 GitHub 直接给域名？因为 GitHub Pages 自带的 `xxx.github.io` 域名在国内访问不稳定。套一层 Cloudflare 会好很多。
{% endnote %}

## 一、准备两样东西

**安装**（一路下一步即可）：

- **Node.js** — 18 或更高，官网下载 LTS 版：[nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)

装完验证一下，能出版本号就行：

```bash
node -v    # 例如 v24.22.0
npm -v
git --version
```

国内建议先把 npm 换成国内镜像，否则装包会慢到怀疑人生：

```bash
npm config set registry https://registry.npmmirror.com
```

**注册**：GitHub 账号、Cloudflare 账号，再准备一个域名（阿里云、[腾讯云](https://curl.qcloud.com/lxNLjrln)、Namesilo 都行，最便宜的 `.xyz` / `.top` 十几块一年）。域名和服务器都可以 [点此注册腾讯云](https://curl.qcloud.com/lxNLjrln) 一站搞定，新用户有专属优惠。

## 二、本地把博客跑起来

```bash
npm install -g hexo-cli        # 安装 Hexo 命令行工具
hexo init my-blog              # 创建站点（my-blog 换成你想要的名字）
cd my-blog
npm install                    # 安装依赖
hexo s                         # 启动本地预览
```

浏览器打开 **`http://127.0.0.1:4000/`** —— 注意是 `127.0.0.1`，不是 `localhost`，原因在后面「踩坑」一节。看到默认页面，说明本地这一环通了。

目录结构不用死记，你只需要知道三个地方：

```
_config.yml          站点主配置（标题、链接、部署）
source/_posts/       你写的文章都放这里
themes/              主题
```

## 三、装个好看的主题

Hexo 默认主题比较简陋，大多数人用 [NexT](https://theme-next.js.org)：

```bash
npm install hexo-theme-next
```

装完做三件事：

1. 把主题配置文件复制到站点根目录，命名为 `_config.next.yml`
   （复制自 `node_modules/hexo-theme-next/_config.yml`）
2. 站点配置 `_config.yml` 里写 `theme: next`
3. 以后改外观**只改根目录的 `_config.next.yml`**

{% note warning %}
为什么非要复制出来？因为主题装在 `node_modules` 里，哪天你执行 `npm install`，改过的东西就全被覆盖了。根目录的 `_config.next.yml` 是官方推荐的写法，重装也不丢。
{% endnote %}

站点配置里这几项建议第一时间改掉：

```yaml
# _config.yml
title: 你的博客名
author: 你的名字
url: https://你的域名.com      # 先填 GitHub 地址也行，有域名后一定记得回来改
language: zh-CN
```

## 四、把源码推到 GitHub

1. 新建仓库，名字**必须**叫 `<你的用户名>.github.io`（比如 `zhangsan.github.io`），权限选 **Public**
2. 本地连上去推：

```bash
git init
git remote add origin https://github.com/<用户名>/<用户名>.github.io.git
git add .
git commit -m "初始化博客"
git branch -M main
git push -u origin main
```

{% note info %}
仓库根目录下确认有 `.gitignore`，里面要有 `node_modules/` 和 `public/`。这两个文件夹不该上传 —— 前者体积巨大，后者是每次自动生成的产物，会打架。
{% endnote %}

## 五、GitHub Actions 自动部署

这一步是整套流程的灵魂：**以后你只管 push 源码，网页由 GitHub 自动帮你生成并上线。**

新建文件 `.github/workflows/pages.yml`，内容照抄（只需改一处 Node 版本）：

```yaml
name: Pages

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: "24"        # ← 改成你本地 node -v 的主版本号
      - name: Install Dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

然后去 GitHub 仓库 **Settings → Pages → Source**，一定要选 **`GitHub Actions`**（不是 Deploy from a branch）。

推上去之后，点仓库的 **Actions** 标签页，能看到流程在跑。绿色 ✓ 就说明部署成功，这时候访问 `https://<用户名>.github.io` 应该能看到博客了。

## 六、绑定自己的域名

这是最容易出错的一段，按顺序做：

**① 本地建 `source/CNAME` 文件**，内容只有一行你的域名：

```
blog.你的域名.com
```

{% note danger %}
这一步千万别省。用 Actions 部署时，GitHub 偶尔会把你手动设的域名清掉，导致域名 404。把这个文件放进 `source/`，它就会跟着每次构建一起上线，等于上了保险。
{% endnote %}

**② GitHub 仓库 Settings → Pages**：Custom domain 填你的域名，勾上 **Enforce HTTPS**，保存。

**③ Cloudflare 加 DNS 记录**：

| 类型 | 名称 | 目标 | 代理状态 |
| --- | --- | --- | --- |
| CNAME | `blog` | `<用户名>.github.io` | 开启（橙色云） |

如果是根域名（`yourdomain.com` 不带前缀），要用 A 记录指向 GitHub Pages 的四个 IP：

```
185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153
```

**④ Cloudflare 的 SSL/TLS**：加密模式改成 **完全（严格）Full (strict)**。

{% note danger %}
这一步设错了会直接打不开。绝不能选「灵活 Flexible」—— 那样 Cloudflare 到 GitHub 之间是明文 http，GitHub 会不停要求跳 https，形成**无限重定向**或者直接报 526 错误。
{% endnote %}

**⑤ 等**。GitHub 签发证书通常几分钟到几小时。期间可以时不时访问一下域名，突然就通了。

验证是否 OK，打开终端执行：

```bash
curl -I https://你的域名/
```

看到 `HTTP/2 200` 就大功告成。

## 七、我踩过的坑（照着排查能省两小时）

这些全是真实遇到过的，网上很多教程不会写：

{% note danger %}
**本地预览能启动，浏览器却一片空白**
终端明明显示 `Hexo is running at http://localhost:4000/`…… 原因是 Windows 把 `localhost` 解析到 IPv6 的 `::1`，而服务没正确响应。**把地址换成 `http://127.0.0.1:4000/` 就好了**，或者启动时用 `hexo s -i 127.0.0.1`。
{% endnote %}

{% note danger %}
**Actions 里除了自己的流程，还多一个 `pages build and deployment` 且一直失败**
这是 GitHub 还在用 Jekyll 按「分支部署」模式处理你的仓库。去 Settings → Pages → Source 改成 **`GitHub Actions`** 即可，多余的失败流程会消失。
{% endnote %}

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 部署成功但域名打不开 | 缺 `source/CNAME` | 补上文件重新部署 |
| 页面能开，样式全没了 | `_config.yml` 里 `url` 没改成真实域名 | 改对后重新 `hexo g` |
| 无限重定向 / 526 错误 | Cloudflare SSL 模式是「灵活」 | 改成完全（严格） |
| 百度怎么都搜不到 | Cloudflare 默认托管了 robots.txt，把一堆爬虫（含 Baiduspider）禁了 | CF 后台 → Bots → 关掉 Managed robots.txt |
| Actions 报 node 版本错误 | workflow 里的版本和你本地不一致 | 改成 `node -v` 的主版本号 |

最后一条尤其重要 —— **Cloudflare 默认会替你生成一份 robots.txt，里面禁止了百度爬虫抓取**。很多人博客上线几个月百度都搜不到，就是栽在这里。

## 八、日常怎么写文章

```bash
hexo new "文章标题"     # 会在 source/_posts/ 生成一篇新 .md
```

用 Typora / VS Code / Obsidian 随便写，Markdown 语法。写完了本地看看：

```bash
hexo clean && hexo g && hexo s
```

确认没问题就发布 —— 记住，**只推源码，不用推生成的网页**：

```bash
git add source/
git commit -m "发布新文章"
git push
```

一分钟后刷新你的域名，文章就在首页了。

## 写在最后

整套东西折腾下来，最难的不是技术，是第一次搞的时候不知道每一步到底在干嘛。搞明白「Hexo 生成 → GitHub 托管 → Cloudflare 指向」这层关系之后，剩下的就是体力活。

如果这篇帮你省下了折腾的时间，那就值了。
