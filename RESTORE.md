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

- **访客统计后端**：Cloudflare Worker `site-counter` + KV + 路由 `*.313270009.xyz/api/*`，全在 CF 云端。前端 `source/js/my-counter.js` 与 `source/_data/footer-inject.njk` 的容器 ID 勿改。
- 要改动 Worker/KV 时需要 Cloudflare API Token（自存，仓库不含密钥）。
