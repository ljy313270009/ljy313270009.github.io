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

- **访客统计后端**：Cloudflare Worker `site-counter` + KV（变量名 `COUNTER`）+ 路由 `<sub>.313270009.xyz/api/*`，全在 CF 云端。源码在 `cloudflare/counter-worker.js`，部署/改动用 `wrangler`。前端 `source/js/my-counter.js` 与 `source/_data/footer-inject.njk` 的容器 ID 勿改。
- 改动 Worker/KV/DNS 等需要 Cloudflare API Token（自存于本地凭据管理器，仓库不含密钥）。详见第 5 节。

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
git push origin main         # 触发 GitHub Pages 重建，线上即最新
```

要点：
- 推送 `main` 即触发 Pages 自动部署，无需本地发版。
- **跨大版本（如 8.x → 9.0）有 breaking change，必须人工确认后再做**；本流程默认只跟 8.x。
- CI（`pages.yml`）用的是 **Node 24**，本机保持 Node 24 可与线上构建环境一致（Node 22 也能 `hexo g`，仅版本略差）。
- 查看当前安装版本：`node -p "require('hexo-theme-next/package.json').version"`。

## 6. Cloudflare 资源管理（由助手维护）

> 博客及你多个项目用 GitHub + Cloudflare 部署。Cloudflare 侧资源（DNS、Worker、KV、Pages、R2 等）由助手通过 API Token + `wrangler` 管理，密钥不在仓库内。

- 账户：`ljy313270009`（登录邮箱 `ljy313270009@gmail.com`，与 GitHub 一致）。
- 域名 Zone：`313270009.xyz`（含 blog/shop 等子域），DNS 记录与子域路由在此管理。
- 访客统计：`site-counter` Worker + `COUNTER` KV（见第 4 节）。
- 其他 GitHub 联动项目若走 Cloudflare Pages / Workers，部署与配置变更也在此账户下由助手操作。
- 密钥轮换：API Token 在 Cloudflare 控制台「My Profile → API Tokens」可随时吊销重建，助手续接时只需重提供新 token。

## 7. 博客更新发布全流程（GitHub + Cloudflare）

> 这是"用 GitHub + Cloudflare 更新博客"的完整链路。**日常发文章只动 GitHub，完全不用碰 Cloudflare**；Cloudflare 只在域名/代理/访客统计层面工作。

### 7.1 整体架构（先理解链路，才知道每一步在干嘛）

| 角色 | 负责什么 |
|---|---|
| **GitHub** | 源码仓库 `ljy313270009.github.io` + CI 构建部署。Push 到 `main` 触发 Actions：`checkout → Node 24 → npm install → npm run build（= hexo generate）→ 上传 public → 部署到 GitHub Pages`。 |
| **GitHub Pages** | 实际托管静态站点的地方；仓库 Pages 设置里 CNAME = `blog.313270009.xyz`。 |
| **Cloudflare** | 在 GitHub Pages 前面做三件事：① DNS（自定义域名）→ ② CDN / SSL / 加速（橙色代理）→ ③ `site-counter` Worker（`*.313270009.xyz/api/*` 路由）做访客统计。 |

一句话：**GitHub 负责"改源码 + 构建上线"，Cloudflare 负责"把自定义域名安全地、加速地递给访客"。**

### 7.2 标准更新流程（日常发文章 / 改配置）

```bash
cd D:/Hexo
# 1) 改内容：编辑 source/_posts/*.md（或 _config.yml / 主题）
# 2) 本地预览（可选）：npx hexo s          # http://127.0.0.1:4000
# 3) 本地构建验证（可选）：npx hexo clean && npx hexo g
# 4) 提交并推送
git add . && git commit -m "..." && git push origin main
```

推送后 GitHub Actions 约 1 分钟构建并部署到 GitHub Pages；Cloudflare 随即经 `blog.313270009.xyz` 把新内容递给访客（CDN 缓存刷新）。**本地和 Cloudflare 都不需要额外操作。**

### 7.3 关键事实（排错 / 接手用）

- CI 固定 **Node 24**（`pages.yml` 写死），本机保持 Node 24 与线上一致；旧机/沙盒 Node 22 也能 `hexo g`，仅版本略有差异。
- `npm run build` ≡ `hexo generate`（见 `package.json` 的 scripts）。
- 自定义域名走 **CNAME**（`blog.313270009.xyz`），不是 Apex `custom_domain`。Cloudflare 对该域名开**代理（orange cloud）**，故 SSL/HTTPS、缓存、访客统计 Worker 全部由 Cloudflare 接管。
- 根域 `313270009.xyz` 的 4 条 A 记录也指向 GitHub Pages IP（`185.199.108~111.153`，代理开），所以根域与 `blog` 子域都能访问。
- 访客统计 Worker `site-counter`：路由 `*.313270009.xyz/api/*`，源码 `cloudflare/counter-worker.js`，绑定 KV `COUNTER`。**只有改它才需要 Cloudflare 权限**（见第 6 节），发文章用不到。

### 7.4 回滚 / 故障

- 若新内容导致 Actions 构建失败，工作流会标红；在本地 `git revert` 上次提交并重新 `push` 即可回到上一个可部署状态，Cloudflare 侧无需操作。
- 若线上未更新：先看 Actions 是否跑完（约 1 分钟）；再看 Cloudflare 该域名是否仍"代理开"且 CNAME 指向 `ljy313270009.github.io`。

### 7.5 可选：将来切换到 Cloudflare Pages 直部署

当前是"GitHub Pages + Cloudflare 代理"。若想改为"Cloudflare Pages 直接从本仓库构建部署"（少一层 GitHub Pages），可新建 Cloudflare Pages 项目并关联 `ljy313270009.github.io` 仓库（构建命令 `npm run build`、输出目录 `public`），再让 Cloudflare 接管域名。需要的话让助手操作（涉及切换托管方式，会先与你确认）。
