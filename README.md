# TextDB EdgeOne

基于 **EdgeOne Pages + KV** 的在线文本数据库。匿名写入/读取，无用户系统、无登录、无注册。

线上地址：https://text.hunluan.space/

## 功能

- **写入**：文本、HTML/JS（自动识别并提供专属渲染链接）、图片与二进制文件
- **读取**：原始文本（`text/plain`）、HTML 渲染（带 CSP）、按扩展名输出、Markdown 渲染
- **文件夹批量上传**：保留目录结构（`webkitdirectory`），自动重写文件内相对引用
- **密码保护**：可为单个 Key 设置密码，后续更新/删除需验证；支持改密与移除
- **二维码**：为任一 Key 生成分享二维码，可下载
- **统计面板**：总 Key 数、总存储量、今日写入数
- **写入队列**：所有写/删/上传经 IndexedDB 队列串行执行，失败指数退避重试 3 次，网络恢复自动继续
- **本地 Key 历史**：localStorage 记录最近 200 个操作过的 Key，支持搜索与快速回填
- **OpenAPI 文档**：`/api` 页面基于 swagger-ui 展示完整规范（6 个路径 / 8 个操作 / 4 个 Schema），支持在线调试
- **页脚品牌行**：EdgeOne Pages / GitHub 两个外链，各配官方 Logo（内联 SVG，见 `src/components/logos.tsx`）

## Commands

```bash
npm run build        # tsc -b && vite build && node build-edge.cjs
npm run dev          # Vite dev server
npm run lint         # eslint .
npm run format       # prettier --write "**/*.{ts,tsx}"
npm run typecheck    # tsc --noEmit
```

**没有测试框架。** `npm run lint` + `npm run typecheck` 是唯一的自动化验证，push 前必须都通过。

## 部署

由 **CNB 流水线**（`.cnb.yml`）驱动，使用官方 `edgeone pages deploy` CLI。GitHub 仅作镜像同步。

| 触发 | 目标环境 | 命令 |
|---|---|---|
| push `dev` | preview | `edgeone pages deploy -n textdb-edgeone -e preview -t "$EDGEONE_PAGES_API_TOKEN"` |
| push `master` | production | `edgeone pages deploy -n textdb-edgeone -t "$EDGEONE_PAGES_API_TOKEN"` |

`sync-to-github` 阶段把分支与 tag 强推到 GitHub 镜像仓库（CNB 是唯一真源）。

> ⚠️ 线上域名 **https://text.hunluan.space/ 绑定的是 dev 分支的部署（preview 环境）**，即 dev 一 push 就会影响线上访问，改部署相关代码需谨慎。`/test-kv` 与 `OPTIONS` 不在 OpenAPI 规范内。

### 关键：部署命令不能带目录参数

`edgeone pages deploy` **必须不传路径**，由 CLI 自行构建 `.edgeone/` 后整体上传。历史上两种传参方式都翻过车：

| 写法 | 后果 |
|---|---|
| `deploy .edgeone` | CLI 以传入目录为上传根，其过滤器会跳过所有 `.<dir>/...` 形式的路径 → 上传 0 个文件 → 平台 `Deploy Failed` |
| `deploy dist` | CLI 视为纯静态直传，**不会读取仓库根的 `edge-functions/`** → 函数未上传 → 线上所有 API 返回 404 |

CLI 不传目录时的构建流程（`.edgeone/` 由 CLI 生成，不是 `build-edge.cjs` 生成）：

```
dist/                      ──►  .edgeone/assets/
edge-functions/[[default]].js ──►  .edgeone/edge-functions/index.js + config.json
                              └─►  .edgeone/routes.json
```

生成的 `routes.json` 路由优先级：

```json
"routes": [
  { "handle": "filesystem" },                                      // 1. 静态资源优先
  { "src": "^/.*$", "server-name": "edge" },                       // 2. 动态路径 → 边缘函数
  { "src": "/.*", "dest": "/index.html", "server-name": "file" }   // 3. SPA fallback
]
```

**因此静态资源无需进函数**，函数只兜底动态路径。

## Architecture

- **前端**：React 19 + Vite + Tailwind CSS v4 + shadcn/ui（radix-nova style）+ lucide 图标
- **后端**：EdgeOne Edge Functions（V8 runtime）+ KV
- **构建**：`build-edge.cjs` 把函数逻辑与 `dist/index.html` 拼成单文件边缘函数

### 边缘函数产物

`build-edge.cjs` 把 `dist/index.html` 内联进函数源码（函数仅在 `/` 与 `/md/{key}` 两处需要 SPA 外壳），输出到 **3 个位置**（内容完全相同）：

- `edge-functions/[[default]].js` ← **CLI 实际读取的就是这个**
- `functions/[[default]].js`
- `functions/api/[[default]].js`

后两个是历史遗留的 legacy 路径，CLI 只在 `edge-functions/` 不存在时才回退到 `functions/`。**这三个文件都是构建产物，不要直接编辑**——`npm run build` 会覆盖它们。

函数文件名必须是 `[[default]].js`（catch-all，匹配所有路径）。用 `index.js` 只会匹配根路径，导致 `/update/`、`/stats` 等全部落到平台 404/SPA fallback。

## API

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/update/` | 写入/更新/删除（JSON `{key, value, password?, new_password?}` 或 FormData） |
| `POST` | `/{key}` | 直接写入（body 即内容） |
| `GET` | `/{key}` | 原始读取（`text/plain`） |
| `GET` | `/p/{key}` | HTML 渲染（CSP 头，用户 HTML 需内联 JS） |
| `GET` | `/file/{ext}/{key}` | 按扩展名输出（自动 Content-Type，html/svg 拒绝，nosniff） |
| `GET` | `/md/{key}` | Markdown 渲染（SPA，前端解析） |
| `GET` | `/stats` | 统计（totalKeys / totalSize / writesToday） |
| `GET` | `/test-kv` | KV 连通性自检（计数器，返回 `{status:"ok",count}`） |
| `DELETE` | `/{key}` | 删除（受密码保护时需 `X-Password` 头） |
| `OPTIONS` | Any | CORS 预检 |

`/update/` 返回 `{"status":1,...}` 表示成功（前端框架约定，`0` 为失败）。完整规范见 `/api` 页面或 [public/openapi.json](public/openapi.json)。

### 限制

| 项 | 限制 | 备注 |
|---|---|---|
| KV key | `^[0-9a-zA-Z_]{1,512}$` | 存储时统一加 `tdb_` 前缀 |
| KV 单值 | **≤ 5,242,879 字节** | 实测；5,242,880 起报 `OverSize`（官方文档写 1 MB，以实测为准）。代码在 5 MiB 处提前拦截 |
| Edge Functions 代码包 | **5 MB / 单个函数** | 官方上限；CI 已加体积断言（见 `.cnb.yml`） |
| Edge Functions CPU Time | 200 ms | 不含 I/O 等待 |
| 请求 Body | 文档 1 MB（实测 ≥ 5.24 MB 可用） | 以实测为准 |
| 单文件 / 单项目 | 25 MB / 20000 个 | 项目维度配额 |
| Cloud Functions 代码包 | 128 MB（含依赖） | 本项目未使用（用的是 Edge Functions） |

边缘函数不可使用 npm 包与 Node.js 内置模块（fs / path / crypto），必须导出 `onRequest` / `onRequestGet` 等 handler，平台不支持 `addEventListener`。

## 踩坑记录（改动部署相关代码前必读）

### 1. 函数代码包不能超过 5 MB

v1.3.0 引入 mermaid / katex / swagger 后 `dist/` 膨胀到 7.1 MB，而 `build-edge.cjs` 当时把**整个 `dist/` 内联**进函数，函数产物达 **9.5 MB**，远超平台单函数 5 MB 上限 → 部署日志打 `Compiled edge functions successfully` 与 `Deploy Success`，但函数实际不生效、线上 API 全部 404。

现在只内联 `dist/index.html`，函数产物约 **20 KB**。**新增前端依赖导致 `dist/` 变大时不会再影响函数体积。**

### 2. 构建必须可复现（哈希不能漂移）

Tailwind CSS v4 会扫描项目内所有未被 `.gitignore` 忽略的文件来收集 class 名。而 `functions/`、`edge-functions/` 是构建产物（内含内联的 `index.html`），被扫描后形成「产物影响 CSS → CSS 改变产物哈希」的自我循环，导致同一份源码每次构建产出不同哈希；部署后旧哈希资源被删除，浏览器缓存的页面就会白屏。

`src/index.css` 里用 `@source not` 排除了这些目录，**不要移除**：

```css
@source not "../functions";
@source not "../edge-functions";
@source not "../dist";
@source not "../.edgeone";
```

验证方法：连续执行两次 `npm run build`，`dist/assets/index-*.{js,css}` 的文件名必须完全一致。

### 3. 产物目录不能被删除操作污染

删除文件时若在项目内产生回收站残留（如 `.Trash-0/`），其中会包含旧的 `dist` 副本，同样会被 Tailwind 扫描并污染构建。`.gitignore` 已忽略该目录。

## Dev Environment (CNB 云原生开发)

点击 CNB 仓库的「云原生开发」按钮即可启动在线环境。配置由以下文件定义：

- **`.ide/Dockerfile`** — 基于 `cnbcool/default-build-env:latest`（已含 Node.js 22、oh-my-zsh、code-server、openssh-server），额外安装 Tailwind CSS / ESLint / Prettier / React Snippets / Error Lens 插件
- **`.ide/settings.json`** — VSCode 编辑器配置（formatOnSave、Prettier 默认格式化、Tailwind CSS class 补全等）
- **`.cnb.yml`**（`$: vscode:` 部分）— 引用 `.ide/Dockerfile`，启动后自动执行 `npm install` → `typecheck` + `lint`

参考 [CNB 默认开发环境](https://cnb.cool/cnb/cool/default-dev-env)。支持 WebIDE / VSCode / Cursor / CodeBuddy 等客户端连接。首次启动后直接 `npm run dev` 即可开发。

## 文档导航

| 文档 | 说明 |
|---|---|
| [AGENTS.md](AGENTS.md) | 给 AI 编码助手的项目指南（架构、约定、约束） |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录（Keep a Changelog 格式） |
| [ROADMAP.md](ROADMAP.md) | 版本规划 |
| [REVIEW_TODO.md](REVIEW_TODO.md) | Code Review 遗留改进项 |
| [docs/superpowers/](docs/superpowers/) | 历史设计文档与实施计划 |
