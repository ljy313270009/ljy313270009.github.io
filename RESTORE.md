# 博客环境恢复指南

> 适用场景：电脑重装系统 / 换新电脑后，恢复博客写作环境。
> 博客的全部数据（文章、配置、主题版本、访客统计前端、CI）都在这个 GitHub 仓库里，**本地电脑不需要任何备份**。

## 0. 重装前你需要知道的

- 线上博客由 **GitHub Pages + Actions** 自动构建部署。就算本地电脑全没了，博客照样在线；甚至可以在 github.com 网页上直接改 markdown 发文章（Actions 会自动构建上线）。
- 本地被 `.gitignore` 排除的只有 `node_modules/`、`public/`、`db.json` 等生成物，全部可由一条 `npm install` 复原。

## 1. 恢复步骤（约 10 分钟）

```bash
# 1) 安装 Git 和 Node.js LTS（≥ 20），然后：
git clone https://github.com/ljy313270009/ljy313270009.github.io.git D:/Hexo
cd D:/Hexo
npm install          # 主题 NexT 8.29 与全部插件按 package-lock.json 精确复原
npx hexo server      # 本地预览 http://127.0.0.1:4000
```

## 2. Git 推送认证

- 克隆免认证，**首次 push** 会要求登录 GitHub（Windows 凭据管理器弹浏览器 OAuth，或用 PAT）。
- 国内直连 GitHub 时通时不通：通了直接 `git push`；不通走本地代理
  `git -c http.proxy=http://127.0.0.1:10808 -c https.proxy=http://127.0.0.1:10808 push origin main`。

## 3. 写作流程速记

- 文章放 `source/_posts/*.md`；front-matter 必含唯一的 `abbrlink`（旧文的不许改，否则线上链接 404）。
- 正文加 `<!-- more -->` 断点；正文用全角引号，避免 ASCII 直引号。
- 分类体系：量化交易 / 技术分享 / 企业融资 / 读书笔记 / 新闻。
- 发布：`git add . && git commit -m "..." && git push`，GitHub Actions 约 1 分钟构建上线，无需本地部署。

## 4. 与本地无关的东西（重装不受影响）

- **访客统计**：Cloudflare Web Analytics（官方统计），页脚 `source/_data/footer-inject.njk` 只含官方 beacon 脚本，数据在 Cloudflare 控制台 Analytics → Web Analytics 查看，站点页面上不显示数字。（自建计数器 Worker/KV 已于 2026-11-23 删除。）
- 改动 DNS/Pages/安全设置等需要 Cloudflare API Token（自存于本地凭据管理器，仓库不含密钥）。详见第 6 节。

## 5. Next 主题更新流程（本地驱动，推荐）

> 策略：保持 `package.json` 里 `"hexo-theme-next": "^8.29.0"` 不变（只锁 8.x 大版本，不会跳到 9.0），每次只更新 `package-lock.json` 到最新 8.x。Dependabot 已对 `hexo-theme-next` 设 `ignore`，不再开 PR，改由本地驱动更新。

**更新主题（让本地与线上都跟到最新 8.x）：**

```bash
cd D:/Hexo
npm update hexo-theme-next   # 仅升级锁文件到最新 8.x
npm install                  # 按新锁文件重装
npx hexo clean && npx hexo g # 全量重建，验证新主题可正常构建
git add package-lock.json    # 只提交锁文件（package.json 通常不变）
git commit -m "chore: 更新 hexo-theme-next 至 x.y.z"
git push origin main         # 触发 Cloudflare Pages 重建，线上即最新
```

要点：
- 推送 `main` 即触发 Pages 自动部署，无需本地发版。
- **跨大版本（如 8.x → 9.0）有 breaking change，必须人工确认后再做**；本流程默认只跟 8.x。
- 线上构建（Cloudflare Pages）用的是 **Node 24**，本机保持 Node 24 可与线上构建环境一致（Node 22 也能 `hexo g`，仅版本略差）。
- 查看当前安装版本：`node -p "require('hexo-theme-next/package.json').version"`。

## 6. Cloudflare 资源管理（由助手维护）

> 博客托管与域名都在 Cloudflare。Cloudflare 侧资源（DNS、Pages、安全设置等）由助手通过 API Token 管理，密钥不在仓库内。

- 账户：`ljy313270009`（登录邮箱 `ljy313270009@gmail.com`，与 GitHub 一致）。
- 域名 Zone：`313270009.xyz`，DNS 在此管理；已开启 DNSSEC、最低 TLS 1.2、HSTS（试行中，max-age 1 天）、Early Hints，并拦截 AI 训练爬虫。
- 托管：Pages 项目 `blog`，关联本仓库 `main` 分支自动构建部署（构建命令 `npm run build`，输出 `public`，Node 24）。自定义域名 `blog.313270009.xyz`；根域 `313270009.xyz` 由重定向规则 301 跳转到 blog 子域（保留路径与查询串）。
- 访客统计：Cloudflare Web Analytics（官方统计，页脚 beacon 注入，数据在控制台查看）。自建计数器（`site-counter` Worker + `COUNTER` KV）已于 2026-11-23 删除。
- 备份：每周日约 21:00 自动把仓库核心内容打包备份到 Google Drive「Muse 工作文档备份」，保留最新 4 份。
- 同账户下另有与博客无关的 Worker：`edgetunnel`（fq 子域）、`tgproxy`（tg 子域）。
- 密钥轮换：API Token 在 Cloudflare 控制台「My Profile → API Tokens」可随时吊销重建，助手续接时只需重提供新 token。

## 7. 博客更新发布全流程（GitHub + Cloudflare Pages）

> **日常发文章只动 GitHub**：push 到 `main` 后 Cloudflare Pages 自动构建部署，约 1 分钟上线。Cloudflare 控制台平时不用碰。

### 7.1 整体架构（先理解链路，才知道每一步在干嘛）

| 角色 | 负责什么 |
|---|---|
| **GitHub** | 只存源码仓库 `ljy313270009.github.io`，不再托管站点（原 GitHub Pages 与 Actions 工作流已停用并删除）。 |
| **Cloudflare Pages** | 项目 `blog` 关联仓库 `main`：每次 push 自动安装依赖 → `npm run build`（= hexo generate）→ 部署 `public`，同时提供托管与 CDN。 |
| **Cloudflare DNS** | `blog.313270009.xyz` 的 CNAME 指向 Pages（代理开）；根域 301 跳转到 blog 子域；SSL 与安全设置在 Zone 层（见第 6 节）。 |

一句话：**GitHub 管源码，Cloudflare 管构建、托管和域名。**

### 7.2 标准更新流程（日常发文章 / 改配置）

```bash
cd D:/Hexo
# 1) 改内容：编辑 source/_posts/*.md（或 _config.yml / 主题）
# 2) 本地预览（可选）：npx hexo s          # http://127.0.0.1:4000
# 3) 本地构建验证（可选）：npx hexo clean && npx hexo g
# 4) 提交并推送
git add . && git commit -m "..." && git push origin main
```

推送后 Cloudflare Pages 约 1 分钟自动构建并部署上线，成败看 Pages 项目 `blog` 的部署列表。**本地和 Cloudflare 控制台都不需要额外操作。**

### 7.3 关键事实（排错 / 接手用）

- 构建环境 **Node 24**（Pages 项目环境变量 `NODE_VERSION=24` 固定），本机保持 Node 24 与线上一致。
- `npm run build` ≡ `hexo generate`（见 `package.json` 的 scripts）。
- 自定义域名 `blog.313270009.xyz`（CNAME → `haikuo-blog.pages.dev`，代理开）；Pages 项目改名不改变 pages.dev 子域。
- 根域 `313270009.xyz` 用占位 A 记录 + 重定向规则 301 到 blog 子域。
- 404 页：仓库 `source/404.html`，Pages 原生返回真实 404 状态。
- 站内搜索与 RSS 在构建时生成：`/search.xml`（hexo-generator-searchdb，配置在 `_config.yml` 的 `search` 段）、`/atom.xml`（hexo-generator-feed）。
- 安全响应头：`source/_headers`（Pages 原生支持；`_config.yml` 的 `include` 含 `_headers` 才会进构建产物）+ Zone 层的 HSTS 设置。

### 7.4 回滚 / 故障

- 构建失败：Pages 保留上一个成功部署继续对外服务，线上不受影响；修好后重新 push 即可。
- 回滚：Pages 控制台项目 `blog` → 部署列表 → 选旧部署 Rollback；或本地 `git revert` 上次提交后重新 push。
- 线上未更新：先看 Pages 部署列表是否跑完且成功；再看 DNS 里 blog 的 CNAME 是否仍指向 Pages 且代理开。

### 7.5 历史

2026-11-22 已从「GitHub Pages 托管 + Cloudflare 代理」切换为 Cloudflare Pages 直部署，本节即按切换后的架构写。如需回退托管：把 DNS 里 blog 的 CNAME 改回 GitHub Pages 并在仓库重新启用 Pages 即可，源码无需改动。
