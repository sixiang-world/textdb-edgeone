# TextDB EdgeOne

EdgeOne Pages + KV 在线文本数据库。匿名写入/读取，无用户系统。

线上地址 https://text.hunluan.space/ **绑定的是 dev 分支的部署（preview 环境）** —— dev 一 push 就会影响线上，改部署相关代码时务必谨慎。

## Commands

```bash
npm run build        # tsc -b && vite build && node build-edge.cjs（3 步）
npm run dev          # Vite dev server
npm run lint         # eslint .
npm run format       # prettier --write "**/*.{ts,tsx}"
npm run typecheck    # tsc --noEmit
```

**没有测试框架。** `npm run lint` + `npm run typecheck` 是唯一的自动化验证，push 前必须通过。

## 部署（CNB 流水线 + edgeone CLI）

`.cnb.yml` 定义，GitHub 仅作镜像同步。

| 触发 | 环境 | 命令 |
|---|---|---|
| push `dev` | preview | `edgeone pages deploy -n textdb-edgeone -e preview -t "$EDGEONE_PAGES_API_TOKEN"` |
| push `master` | production | `edgeone pages deploy -n textdb-edgeone -t "$EDGEONE_PAGES_API_TOKEN"` |

Token 来自私密仓库，由 CNB 注入环境变量。`sync-to-github` 阶段把分支/tag 强推到 GitHub 镜像。

### 部署命令必须不传目录参数

**不要给 `edgeone pages deploy` 加路径参数。** 两种传参都翻过车：

| 写法 | 后果 |
|---|---|
| `deploy .edgeone` | CLI 以传入目录为上传根，过滤器跳过所有 `.<dir>/...` 路径 → 上传 0 文件 → `Deploy Failed` |
| `deploy dist` | 纯静态直传，**不读取仓库根 `edge-functions/`** → 函数未上传 → 线上 API 全 404 |

不传目录时，CLI 按 `edgeone.json` 构建并生成 `.edgeone/`（**不是 `build-edge.cjs` 生成的**）：

```
dist/                          ──►  .edgeone/assets/        （静态资源，由平台 filesystem 托管）
edge-functions/[[default]].js  ──►  .edgeone/edge-functions/index.js + config.json
                               └─►  .edgeone/routes.json
```

`routes.json` 优先级：`{handle:"filesystem"}`（静态优先）→ `^/.*$` 走 edge 函数 → `/.*` → `/index.html`（SPA fallback）。**所以静态资源无需进函数。**

`edgeone.json` 只保留 `buildCommand` / `installCommand` / `nodeVersion`，**不要加回 `outputDirectory`**（会触发 StaticAssetsBuilder 自拷贝报错，且方案 A 下由 CLI 自行决定产物目录）。

流水线里的 `npm run build` 是**必要的**：CLI 只读取仓库根 `edge-functions/[[default]].js`，必须先在 CI 里由 `build-edge.cjs` 用当前源码重新生成它。

## Dev Environment (CNB 云原生开发)

点击 CNB 仓库的「云原生开发」按钮即可启动在线环境。配置由以下文件定义：

- **`.ide/Dockerfile`** — 基于 `cnbcool/default-build-env:latest`（已含 Node.js 22、oh-my-zsh、code-server、openssh-server），额外安装 Tailwind CSS / ESLint / Prettier / React Snippets / Error Lens 插件
- **`.ide/settings.json`** — VSCode 编辑器配置（formatOnSave、Prettier 默认格式化、Tailwind CSS class 补全等）
- **`.cnb.yml`**（`$: vscode:` 部分）— 引用 `.ide/Dockerfile`，启动后自动执行 `npm install` → `typecheck` + `lint` 验证

参考 [CNB 默认开发环境](https://cnb.cool/cnb/cool/default-dev-env)。支持 WebIDE / VSCode / Cursor / CodeBuddy 等客户端连接。首次启动后直接 `npm run dev` 即可开发。

## Architecture

- **前端**：React 19 + Vite + Tailwind CSS v4 + shadcn/ui (radix-nova style) + lucide 图标
- **后端**：EdgeOne Edge Functions (V8 runtime) + KV
- **部署**：CNB 流水线 + edgeone CLI（见上）

### 边缘函数产物

`build-edge.cjs` 把**仅 `dist/index.html`** 内联进函数源码（函数只在 `/` 与 `/md/{key}` 两处需要 SPA 外壳），输出到 3 个位置（内容相同，均为构建产物，**不要直接编辑**）：

- `edge-functions/[[default]].js` ← **CLI 实际读取的就是这个**
- `functions/[[default]].js`、`functions/api/[[default]].js` ← legacy 路径，CLI 仅在 `edge-functions/` 缺失时回退

函数文件名必须是 `[[default]].js`（catch-all）。用 `index.js` 只匹配根路径，`/update/`、`/stats` 等会落到平台 404/SPA fallback。

Edge Functions 不能使用 npm 包与 Node.js 内置模块（fs/path/crypto）。

## Key Files

| File | Role |
|------|------|
| `build-edge.cjs` | 构建脚本 — 把函数逻辑 + `dist/index.html` 拼成单文件边缘函数，写 3 个位置 |
| `.cnb.yml` | CNB 流水线（部署 + sync-to-github）+ 云原生开发环境配置 |
| `edgeone.json` | CLI 构建配置（buildCommand / installCommand / nodeVersion） |
| `.ide/Dockerfile` | CNB 云开发环境镜像（extends cnbcool/default-build-env） |
| `.ide/settings.json` | VSCode workspace 配置（formatOnSave、Tailwind IntelliSense） |
| `edge-functions/[[default]].js` | 生成的边缘函数（勿手改） |
| `src/App.tsx` | 前端入口，SPA 路由（解析 `/md/{key}`） |
| `src/api.ts` | API 调用封装（getStats / writeData / deleteData / readData / uploadFile） |
| `src/index.css` | Tailwind 入口，含 `@source not` 构建排除规则（勿删） |
| `src/components/WriteCard.tsx` | 写入卡片（文本/文件/HTML 识别 + 密码） |
| `src/components/FolderUpload.tsx` | 文件夹批量上传（webkitdirectory） |
| `src/components/MdRenderer.tsx` | Markdown 渲染页（`/md/{key}`） |
| `src/components/Sidebar.tsx` + `Layout.tsx` | 侧边栏导航与整体布局 |
| `src/components/pages/*` | 四个页面：OperatePage / FolderPage / ApiDocsPage / ChangelogPage |
| `src/components/KeyHistory.tsx` | 本地 Key 历史列表 |
| `src/components/QueueStatus.tsx` | 写入队列状态浮层 |
| `src/components/logos.tsx` | 内联品牌 SVG：CNB（官方 Symbol，橙 #FF6200）、EdgeOne（官方 Symbol，渐变 #00DDFF→#0C60F2）、GitHub mark |
| `src/components/Footer.tsx` | 页脚：统计行 + 品牌行（EdgeOne Pages / GitHub 外链，各配 Logo）。**CNB 链接有意注释掉**：CNB 是主仓库但保持私有（避免云构建日志中的密钥等隐私信息外泄），对外只暴露由 `sync-to-github` 自动同步的 GitHub 公开镜像 |
| `src/lib/writeQueue.ts` | IndexedDB 串行写入队列（指数退避重试） |
| `src/lib/keyHistory.ts` | localStorage Key 历史（最近 200 条） |
| `src/lib/folderUtils.ts` | 文件夹上传工具（pathToKey / rewriteRefs / isBinary） |
| `public/openapi.json` | OpenAPI 3.0.3 规范（`/api` 页面与 `/openapi.json` 使用） |
| `functions/test-kv.js` | 历史遗留的独立 KV 自检函数，**未被使用**（CLI 只读 `edge-functions/`） |

## API

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/update/` | 写入/更新/删除（JSON `{key, value, password?, new_password?}` 或 FormData） |
| `POST` | `/{key}` | 直接写入（body 即内容） |
| `GET` | `/{key}` | 原始读取（`text/plain`） |
| `GET` | `/p/{key}` | HTML 渲染（CSP 头） |
| `GET` | `/file/{ext}/{key}` | 按扩展名输出（auto Content-Type，html/svg 拒绝，nosniff） |
| `GET` | `/md/{key}` | Markdown 渲染（SPA，前端解析） |
| `GET` | `/stats` | 统计（totalKeys / totalSize / writesToday）via `TEXTDB.list()` |
| `GET` | `/test-kv` | KV 连通性自检（由主函数处理，非 `functions/test-kv.js`） |
| `DELETE` | `/{key}` | 删除（受密码保护时需 `X-Password`） |
| `OPTIONS` | Any | CORS 预检 |

成功响应为 `{"status":1,...}`，失败为 `{"status":0,"error":...}`。

密码来源（**两条路径不一致，属已知问题**，见 `REVIEW_TODO.md` 第 5 项）：

- 写入/更新路径：body `password` 优先，回退 `X-Password` 头（`params.password || X-Password`）
- 删除路径：`X-Password` 头优先，回退 body `password`（`X-Password || params.password`）

## Code Style

- **Prettier**: `semi: false`, `singleQuote: false`, `trailingComma: "es5"`, `printWidth: 80`
- **Tailwind CSS**: `@` alias → `./src`（`vite.config.ts` 与 `tsconfig` 均已配置）
- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`
- **Buttons/Tabs**: shadow-based 3D press effect（浮起→inset shadow + translate），参考现有组件
- **shadcn/ui**: radix-nova style, lucide icons。不要假设存在其他组件库

## Project Conventions

- `AGENTS.md` 是唯一真源；`CLAUDE.md` 是它的软链接
- push 会触发部署（dev → preview，master → production）——**push 前列出改动清单**，且线上域名绑的是 dev 的部署
- 无测试框架，push 前跑 lint + typecheck
- `dist/`、`.edgeone/`、`.Trash-0/` 已 gitignore；`functions/` 与 `edge-functions/` **已跟踪**（EdgeOne 需要它们在仓库里），由 `npm run build` 重新生成
- 提交构建产物时体积应约 20 KB；若发现 `edge-functions/[[default]].js` 变成 MB 级，说明误把整个 dist 内联了

## Runtime Constraints

- KV 绑定：**`context.env.TEXTDB`**，在 `onRequest` 入口注入到 `globalThis`，后续代码直接用全局 `TEXTDB`
- KV API: `TEXTDB.get(key)`, `TEXTDB.put(key, value)`, `TEXTDB.delete(key)`, `TEXTDB.list({prefix?, limit?, cursor?})`
- KV list 返回 `{complete, cursor, keys: [{key}]}`，每页最多 256 条
- KV key 正则 `^[0-9a-zA-Z_]{1,512}$`，存储时统一加 `tdb_` 前缀；内部计数器用 `__writes__YYYY-MM-DD`
- KV 单值上限：**≤ 5,242,879 字节**（5,242,880 起 KV 报 `OverSize`），代码在 5 MiB 处提前拦截并返回友好错误
  ⚠️ 官方文档写的是 1 MB，但线上实测 5,242,879 字节可正常写入并读回，**以实测为准**。若平台后续收紧到文档值，需同步调整代码里的拦截阈值
- 函数必须导出 `onRequest` / `onRequestGet` 等 handler；平台**不支持 `addEventListener`**
- 路由优先级：静态资源优先于函数（官方文档与 `routes.json` 的 `{handle:"filesystem"}` 一致）
- 路由大小写敏感（`/helloworld` → `helloworld.js`）；`[id].js` 单级动态、`[[default]].js` 多级动态

### 官方限制与配额（pages.edgeone.ai/zh/document/limits-and-quotas，2026-09 核对）

| 项 | 限制 | 备注 |
|---|---|---|
| **Edge Functions 代码包** | **5 MB / 单个函数** | 非全项目总量口径；CI 已加体积断言（见 `.cnb.yml` 头部） |
| Edge Functions CPU Time | 200 ms | 不含 I/O 等待 |
| Edge Functions 执行次数 | 300 万 / 月 | 免费版 |
| Edge Functions 请求 body | 文档 1 MB（实测 ≥ 5.24 MB 可用） | 不一致，以实测为准 |
| 单文件大小 | 25 MB | 项目维度；当前最大资源 2.3 MB |
| 单项目文件数 | 20000 | 当前 124 个静态资源 |
| 总存储容量 | 5 GB | 按站点统计 |
| KV 存储空间 | 1 GB | 单值大小文档写 1 MB（实测 5 MiB） |
| 构建次数 / 并发 / 超时 | 500 次/月、并发 1、20 分钟 | 算力 4 核 6 GB |
| 自定义域名 | 200 个 | |
| Cloud Functions 代码包 | 128 MB（含依赖） | 本项目未使用 |

> 注：Edge Functions 与 Cloud Functions 是两套体系，配额不同。本项目用的是 **Edge Functions**（V8 runtime，无 npm 包、无 Node 内置模块）。
- `/p/` 的 CSP：`script-src 'unsafe-inline'`（有意为之——用户 HTML 需内联 JS；公开写入场景下确有 XSS 风险）
- `/p/` 的 CSP：`connect-src 'none'`（渲染页内所有 fetch/XHR 被阻断）
- 首页带 `Vary: User-Agent`（区分 AI 爬虫），注意 CDN 缓存碎片化

## 踩坑记录（改部署/构建前必读）

### 1. 函数代码包不能超过 5 MB

v1.3.0 引入 mermaid / katex / swagger 后 `dist/` 涨到 7.1 MB，而当时 `build-edge.cjs` 把**整个 dist 内联**进函数 → 函数产物 **9.5 MB**，超平台 5 MB 上限。症状极具迷惑性：CI 日志显示 `Compiled edge functions successfully` + `Deploy Success`，但线上所有 API 返回 404。

现在只内联 `dist/index.html`（函数约 **20 KB**）。**前端依赖变大不会再影响函数体积。**

**`.cnb.yml` 已加自动防线**：两条部署链路（preview / production）在 `npm run build` 之后、`edgeone pages deploy` 之前会遍历 `edge-functions/**/*.js` 校验体积——
- 超过 **5 MB**（官方单函数上限，当前 19 KB，余量 274 倍）→ **FAIL，中断部署**
- 超过 **256 KB**（正常值 13 倍）→ **WARN，不阻断**，用于提前暴露「误内联 dist 但未超限」的情况（历史 master 版本函数为 705 KB，正是这种漏网情形——低于 5 MB 却在同一个错误架构上）
- `edge-functions/` 下找不到 `.js` 产物 → FAIL（防构建未生效）

### 2. 构建必须可复现（哈希不能漂移）

Tailwind v4 会扫描项目内所有未被 `.gitignore` 忽略的文件收集 class 名。`functions/`、`edge-functions/` 是构建产物（内含内联的 `index.html`），被扫描后形成「产物影响 CSS → CSS 改变哈希」的自我循环 → 每次构建哈希都不同 → 部署后旧哈希资源被删 → 用户浏览器缓存失效白屏。

`src/index.css` 中的排除规则**不要移除**：

```css
@source not "../functions";
@source not "../edge-functions";
@source not "../dist";
@source not "../.edgeone";
```

验证：连续跑两次 `npm run build`，`dist/assets/index-*.{js,css}` 文件名必须完全一致。

### 3. 产物目录不能被删除残留污染

在项目内删除文件若产生回收站目录（如 `.Trash-0/`），其中含旧 `dist` 副本，同样会被 Tailwind 扫描并污染构建。`.gitignore` 已忽略它。

### 4. 部署后如何验证

```bash
curl -s https://text.hunluan.space/stats      # 应返回 JSON，若返回平台 HTML 404 页则函数未生效
curl -s https://text.hunluan.space/test-kv    # 应返回 {"status":"ok",...}
```

`GET /nonexistent_key` 应返回**空 body 200**（函数行为），而不是 HTML 404 页（平台行为）。
