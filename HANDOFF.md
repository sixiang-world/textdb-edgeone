# 阅读该文档继续完成当前会话

> **文档目的**：完整继承一次开发会话的全部上下文，使**没有历史对话记录**的接手者（人或 AI）能立即接续工作，不重复踩坑、不遗漏决策。
>
> **写于**：2026-09-15
> **仓库**：`/workspace`（TextDB EdgeOne，私有主仓库在 CNB `shisheng820/textdb-edgeone`，GitHub 为公开镜像）
> **当前分支**：`dev`（本地 `ad10da6`）
> **配套计划文件**：`docs/superpowers/plans/2026-09-15-review-todo-remediation.md`（逐 Task 的实施规格，本会话的执行依据）

---

## 0. 如何恢复这个会话（先读这里）

### 推荐恢复提示词

把下面这段直接发给 AI 助手：

```
请阅读 /workspace/HANDOFF.md 与 docs/superpowers/plans/2026-09-15-review-todo-remediation.md，
完整继承上下文后继续完成遗留事项整改。当前进度：Phase 0/1/2 代码已完成，Phase 2 待线上运行时验证。
请从「第 7 节 待办事项」的 T1 开始，按既定的 subagent 双评审流程推进。
```

### 接手者必须知道的 6 件事（否则会踩坑）

1. **`npm test` 必须先构建**：测试导入的是构建产物 `edge-functions/[[default]].js`，而函数逻辑唯一真源是 `build-edge.cjs`。测试脚本已内置 `npm run build`，不要绕过。
2. **改函数逻辑只能改 `build-edge.cjs`**：`edge-functions/`、`functions/`、`functions/api/` 下的三个 `.js` 都是**构建产物**，手改会被下次构建覆盖。
3. **`edge-functions/[[default]].js` 绝不能超过 5 MB**：CI 已加硬校验（超限直接中断部署）。当前 21.7 KB。见第 5 节。
4. **构建必须可复现**：`src/index.css` 里的 **7 条** `@source not` 规则**不可删除**，否则产物哈希漂移、用户缓存失效。见第 5 节。
5. **部署命令绝不能带目录参数**：`edgeone pages deploy` 必须不传路径。见第 5 节。
6. **push 会触发线上部署**：`dev` → preview 域名，`master` → production 域名，且**两个域名都对外可访问**。见第 3 节。

---

## 1. 会话目标（已确定的需求）

本会话由「CI/CD 构建失败」的排查请求开始，最终演变为两条并行主线：

### 主线 A：修复生产故障链（✅ 已完成并上线）

线上 `textdb.hunluan.space` 出现「页面能打开，但所有 API 返回 404」。逐层排查出**三个独立缺陷**：

| # | 缺陷 | 根因 |
|---|---|---|
| A1 | 部署失败 / 函数未上传 | `.cnb.yml` 用 `deploy .edgeone`（CLI 上传过滤器跳过所有 `.<dir>/...` 路径 → 上传 0 文件 → `Deploy Failed`）；改传 `dist` 后又变成纯静态直传、根本不读 `edge-functions/` |
| A2 | 函数编译成功却不生效 | `build-edge.cjs` 把整个 `dist/`（7.1 MB）内联进函数 → 函数 9.5 MB，超 EdgeOne **单函数 5 MB** 上限。平台仍返回 `Deploy Success`，CI 全绿 |
| A3 | 部署后页面白屏 | 构建不可复现：Tailwind v4 扫描 `functions/`、`edge-functions/` 等**构建产物**（内含内联 HTML），形成「产物影响 CSS → CSS 改变产物哈希」的自我循环 |

### 主线 B：REVIEW_TODO 遗留事项整改（🟡 进行中，Phase 0-2 完成）

将 `REVIEW_TODO.md` 的 6 项 Code Review 遗留问题落地修复，并为边缘函数建立可回归的测试基线（项目此前**没有任何测试框架**）。

### 会话产出的实施计划

`docs/superpowers/plans/2026-09-15-review-todo-remediation.md`（约 760 行）——按 `superpowers:writing-plans` skill 规范编写，含 7 个 Phase、每个 Task 带 `Files:` 块、TDD 步骤、风险回退表与完成定义。**所有后续工作都应以此计划为准**。

---

## 2. 会话中确立的执行流程（必须沿用）

用户明确选择了 **Subagent 驱动开发模式**（`superpowers:subagent-driven-development`）。本会话的实际执行形态：

| 角色 | 由谁承担 | 说明 |
|---|---|---|
| 实现者 | **主 agent**（我自己） | 写代码、跑测试、提交 |
| 规格评审 | **subagent** | 逐字核对实现与计划规格是否一致 |
| 质量评审 | **subagent** | 检查代码质量、测试质量、架构、文档 |
| 修复 | **主 agent** | 按评审意见修复，再送复审 |

**环境限制（重要）**：本环境只提供**只读**的 subagent（`code-explorer`），没有可写文件的 subagent 类型。因此无法按 skill 原文「派发实现者 subagent」，改为「主 agent 实现 + subagent 双评审」。**评审本身是只读活动，与可用工具正好匹配，质量门禁未降级。**

**每个 Task 的固定流程**：

```
1. 实现（TDD：先写失败测试 → 确认失败 → 最小实现 → 确认通过）
2. 本地验证（npm test / typecheck / lint / 构建产物检查）
3. git commit（⚠️ 绝不 git push，push 由用户决定时机）
4. 派发 subagent「规格评审」→ 处理发现项 → 必要时复审
5. 派发 subagent「质量评审」→ 处理 Critical/Important → 派发复审直至 Yes
6. 回写计划文件（标记 Task 状态、记录实测偏差）
7. 用户确认后再 push
```

**评审 prompt 模板**位于 `~/.codebuddy/plugins/marketplaces/codebuddy-plugins-official/external_plugins/superpowers/skills/subagent-driven-development/`（`implementer-prompt.md` / `spec-reviewer-prompt.md` / `code-quality-reviewer-prompt.md`）。评审报告要求：按真实性分级（Critical/Important/Minor），不得把琐碎问题标为 Critical，必须给出明确结论。

**本会话已验证有效的评审要点**（后续沿用）：
- 明确告知评审者「**不要信任实现者的报告**，必须读实际代码独立验证」
- 让评审者核对**行号引用**是否仍准确（计划文件常因编辑而漂移）
- 让评审者检查**文档同步**（项目有 `AGENTS.md` / `README.md` / `CHANGELOG.md` / `REVIEW_TODO.md`，容易漏）
- 要求评审者检查「**多余工作/范围蔓延**」（避免顺手改无关代码）

---

## 3. 当前仓库与部署状态

### 分支

| 分支 | 提交 | 状态 |
|---|---|---|
| **`dev`（本地）** | `ad10da6` | 领先 `origin/dev` **7 个提交**（本次交接将推送） |
| `origin/dev` | `2724eec` | 计划文件已推送，Phase 0-2 代码未推送 |
| `origin/master` | `36ecf54` | **是 dev 的祖先**（dev 完全包含 master）。合并时可直接 fast-forward |
| `origin/backup-master-5b3cdd9` | — | 早期误合并的备份，保留中，暂不删除 |
| `origin/backup-20260323`、`origin/auto/fix-deploy-ce65`、`origin/auto/fix-edgeone-alpine-ded7` | — | 历史分支，可清理 |

### 域名与环境绑定（实测确认，此前文档记载有误）

| 域名 | 绑定环境 | 由哪次 push 触发 |
|---|---|---|
| **https://textdb.hunluan.space/** | **production** | `master` push |
| https://text.hunluan.space/ | **preview** | `dev` push |

**两个域名都对外可访问**。`text.hunluan.space` 绑的是 preview —— dev 一 push 就会改变它的内容，需谨慎。

判定依据：两者 `index.html` 的 `Last-Modified` 与 `EO-LOG-UUID` 不同（是两次独立部署），内容一致是因为 dev 已合入 master。

### 部署链路

```
push dev    → CNB 流水线 → edgeone pages deploy -n textdb-edgeone -e preview -t "$EDGEONE_PAGES_API_TOKEN"
push master → CNB 流水线 → edgeone pages deploy -n textdb-edgeone -t "$EDGEONE_PAGES_API_TOKEN"
```

- Token 来自 CNB 私密仓库，由平台注入环境变量
- `sync-to-github` 阶段把分支/tag **强推**到 GitHub 镜像
- 流水线在 `npm run build` 之后、`deploy` 之前有**函数体积校验**（5 MB 硬失败 / 256 KB 预警 / 产物缺失失败）

### 当前产物基线（用于识别回归）

| 项 | 值 |
|---|---|
| 边缘函数体积 | **21.7 KB**（上限 5 MB） |
| 前端产物 | `index-CsZsNk6z.js` / `index-lsvc-_00.css` |
| 测试 | **42 项**（api 12 / password 18 / stats 7 / helpers 5） |
| `npm test` 耗时 | 约 25 秒（含一次完整构建） |
| CNB 校验器告警 | 19 条，**全部集中在 `$: vscode:` 段**，属存量问题（改动前后数量应一致） |

---

## 4. 已完成的工作（逐提交）

### 4.1 主线 A：部署链路修复（已上线生产 ✅）

| 提交 | 内容 |
|---|---|
| `5d9c186` | （会话开始前）edge function 未被路由导致 POST /update/ 返回 HTML |
| `b56f3a6` | **改走方案 A**：`edgeone pages deploy` 不传目录参数，由 CLI 自动构建 `.edgeone/` 后整体上传 |
| `9180ad1` | **函数瘦身**：`build-edge.cjs` 只内联 `dist/index.html`（而非整个 dist），9.5 MB → 19.6 KB |
| `032d90f` | **构建确定性**：`@source not` 排除 `functions/`、`edge-functions/`、`dist/`、`.edgeone/`；`.gitignore` 忽略 `.Trash-0/` |
| `41b0fbd` | 全面更新 `README.md` / `AGENTS.md` / `CHANGELOG.md` / `ROADMAP.md` / `REVIEW_TODO.md`，纠正过时的部署/构建/KV 描述 |
| `7a4a0c8` | 页脚加入 CNB / GitHub / EdgeOne 三个外链，各配官方 Logo（内联 SVG） |
| `62d27bc` | 注释掉 CNB 链接（仓库私有，避免云构建日志泄露密钥），仅对外暴露 GitHub 镜像 |
| `817c0ac` | CI 加入**函数体积校验**（按官方 5 MB 上限） |
| `d8e0076` | 修正首页 AI 爬虫逻辑描述——实测为**死代码** |
| `36ecf54` | 补记两个自定义域名的环境绑定关系（见第 3 节） |

### 4.2 主线 B：REVIEW_TODO 整改

| Phase | 状态 | 提交 |
|---|---|---|
| **Phase 0** 测试基线 | ✅ 完成 | `782f4d6` + 评审修复 `0d6cffd` / `8bf3412` / `5f0fd60` |
| **Phase 1** 恒定时间比较 | ✅ 完成 | `38f0b4d` + 对齐 `76d67d0` |
| **Phase 2** PBKDF2 + 迁移 | 🟡 代码完成，**待线上验证** | `ad10da6` |
| Phase 3 密码优先级统一 | ⏳ 待执行 | — |
| Phase 4 localStorage 保护 | ⏳ 待执行 | — |
| Phase 5 `--force` 决策 | ⏳ 待用户决策 | — |
| Phase 6 死代码处置 | ⏳ 待用户决策 | — |

**Phase 0 交付**：`tests/` 目录（4 个文件，42 项测试）——`helpers.mjs`（KV mock + `onRequest` 调用封装）、`api.test.mjs`（12 项 API 基线）、`stats.test.mjs`（7 项 `/stats` 分页与扫描上限）、`helpers.test.mjs`（5 项 mock 自身语义）、`password.test.mjs`（18 项密码链路）。`package.json` 新增 `test` + `pretest`。

**Phase 1 交付**：`constantTimeEqual()` 替代 `===` / `!==` 哈希比较，消除计时侧信道。纯重构，行为不变。

**Phase 2 交付**：`PASSWORD_VERSION=2` / `PBKDF2_ITERATIONS=100000` / `pbkdf2Hex()` / `hashForVersion()`；`setPasswordMeta` 写 v2；`checkPassword` 版本感知且 **v1 校验通过后透明升级为 v2**（复用原盐 + 记时间戳，失败不写回）；`verifyDeletePassword` 版本感知（不迁移）。

---

## 5. 关键背景知识（踩坑记录，勿重复踩）

### 5.1 函数代码包不能超过 5 MB

官方限制（`pages.edgeone.ai/zh/document/limits-and-quotas`）：**Edge Functions 代码包 = 5 MB / 单个函数**。

事故形态：v1.3.0 引入 mermaid / katex / swagger 后 `dist/` 达 7.1 MB，而 `build-edge.cjs` 当时把整个 `dist/` 内联 → 函数 9.5 MB 超限。**平台仍返回 `Deploy Success` 与 `Compiled edge functions successfully`，只是函数不生效、线上 API 全部 404** —— 极具迷惑性。

关键洞察：**仅靠 5 MB 门槛拦不住这一类问题**。历史 master 版本函数为 705 KB（同样内联了整个 dist，犯了同一个错）却低于 5 MB。因此 CI 采用双阈值：5 MB 硬失败 + 256 KB 预警（正常值 19 KB 的 13 倍，与最小事故值差 2.7 倍）。

### 5.2 部署命令不能带目录参数

CLI 上传过滤器的实现在 `edgeone-dist/cli.js`：

```js
.filter(u => !(u.FilePath.endsWith("/") || u.Key === "/" || u.Key === ""
    || (u.FilePath !== e && u.FilePath.startsWith(".") && u.FilePath !== basename(u.FilePath))
    || u.FilePath.startsWith(`node_modules${sep}`)))
```

| 写法 | 后果 |
|---|---|
| `deploy .edgeone` | 每个文件路径都是 `.edgeone/xxx` → 全部命中 `startsWith(".")` 被跳过 → **上传 0 个文件** → 平台 `Deploy Failed` |
| `deploy dist` | CLI 视为纯静态直传，**不读取仓库根 `edge-functions/`** → 函数未上传 → 线上 API 全 404 |
| **`deploy`（不传路径）** | ✅ CLI 按 `edgeone.json` 构建 `.edgeone/`（`dist/` → `assets/`，`edge-functions/` → `.edgeone/edge-functions/`）后整体上传 |

生成的 `routes.json` 优先级：

```json
"routes": [
  { "handle": "filesystem" },                                      // 1. 静态资源优先
  { "src": "^/.*$", "server-name": "edge" },                       // 2. 动态路径 → 边缘函数
  { "src": "/.*", "dest": "/index.html", "server-name": "file" }   // 3. SPA fallback
]
```

**因此静态资源无需进函数**，函数只兜底动态路径。

### 5.3 构建必须可复现（哈希不能漂移）

Tailwind CSS v4 会扫描项目内所有**未被 `.gitignore` 忽略**的文件来收集 class 名，**包括 `.md`**。而 `functions/`、`edge-functions/` 是构建产物（内含内联的 `index.html`），被扫描后形成自我循环：

```
build N: 扫描 edge-functions/[[default]].js（含 dist_{N-1} 的内容）→ CSS_N
      → build-edge.cjs 写出含 dist_N 的产物
build N+1: 扫描新产物 → CSS_{N+1} ≠ CSS_N
```

后果：同一份源码每次构建产出不同哈希 → 部署后旧哈希资源被删除 → 用户浏览器缓存的页面白屏。

`src/index.css` 中的 **7 条**排除规则（第 13-23 行）**不可删除**：

```css
@source not "../functions";
@source not "../edge-functions";
@source not "../dist";
@source not "../.edgeone";
@source not "../docs";      /* 文档里的代码片段含 Tailwind 类名，实测曾有 17 个类由此进入 CSS */
@source not "../tests";
@source not "../*.md";      /* 根目录 markdown，防御性排除 */
```

验证方法：连续两次 `npm run build`，`dist/assets/index-*.{js,css}` 文件名必须**完全一致**。

### 5.4 其它已核实的官方限制与实测值

| 项 | 官方值 | 实测 |
|---|---|---|
| 边缘函数代码包 | 5 MB / 单函数 | 当前 21.7 KB |
| 边缘函数 CPU Time | 200 ms | PBKDF2 100k 约 13 ms（约 6%） |
| 请求 Body | **文档写 1 MB** | **实测 ≥ 5.24 MB 可用** → 以实测为准，代码层在 5 MiB 拦截 |
| KV 单值 | **文档写 1 MB** | **实测 ≤ 5,242,879 字节**（5,242,880 起报 `OverSize`） |
| 单文件 / 单项目 | 25 MB / 20000 个 | 2.3 MB / 124 个 |
| WebCrypto `deriveBits` | 仅支持 **ECDH / HKDF / PBKDF2** | PBKDF2 可用 |

### 5.5 密码来源有三条路径（行为各不相同）

此前文档误记为「两条路径不一致」，2026-09-15 逐行核实后修正：

| 入口 | 代码位置 | 密码来源 | 是否缺陷 |
|---|---|---|---|
| `POST /update/` 写入/更新 | `build-edge.cjs` 的 `handleApi` | `params.password \|\| X-Password`（body 优先） | 参照基准 |
| `POST /update/` 删除（`value` 为空串） | 同上 | `X-Password \|\| params.password`（**header 优先**） | ✅ 真实缺陷（REVIEW_TODO #5，Phase 3 要修） |
| `DELETE /{key}` | 同上 | 仅 `X-Password`，body 被忽略 | ❌ **符合规范**——`public/openapi.json` 的该操作只声明 `XPassword` 头参数、无 requestBody |

前端 `src/api.ts` 的 `deleteData()` 走**第二条**（`POST /update/` + `value:""` + body 传密码），故前端功能正常。

### 5.6 首页 AI 爬虫逻辑是死代码

`build-edge.cjs` 中 `onRequest` 针对 `/` 与 `/index.html` 的 `Vary: User-Agent` + 爬虫 `Cache-Control: no-cache, private` 分支**在生产环境从不执行**——`routes.json` 的 `{handle:"filesystem"}` 优先，而 `dist/index.html` 是真实静态文件，故由平台静态托管直接返回。

证据：真实响应头为平台默认的 `Vary: Origin, Access-Control-Request-Headers, Access-Control-Request-Method` 与 `Cache-Control: public,max-age=0,must-revalidate`，**不含** `Vary: User-Agent`；无对应静态文件的路径（`/md/*`、`/stats`、`/p/*`）才走函数。

影响有限（静态 `index.html` 已内嵌 JSON-LD）。处置方案对比见 Phase 6，**推荐方案③（移除死代码）**，因为方案①（`edgeone.json` 的 headers）无法实现「爬虫 no-cache」的条件分支，方案②（删除 `dist/index.html`）有破坏 SPA fallback 的风险。

### 5.7 CNB 仓库为私有（有意为之）

CNB 是**主仓库**，GitHub 仅为公开镜像（由 `sync-to-github` 自动强推）。CNB 保持私有是为保护云构建日志中的密钥等隐私信息。因此**页脚有意不提供 CNB 链接**（代码中已注释，含恢复方法）。

### 5.8 测试的两条硬约束

1. **同一测试文件内的用例必须串行**（Node 默认行为）。不要给 `test()` / `describe()` 开启 `concurrency`：边缘函数把 `context.env.TEXTDB` 写入 `globalThis.TEXTDB`（**进程内共享**），并发调用会互相覆盖 KV 绑定。不同测试文件由独立子进程运行，互不影响（已实证）。
2. **每个用例各自 `makeKV()` 建独立实例**，不要共享。

已知限制：`eslint.config.js` 只匹配 `**/*.{ts,tsx}`，`npm run lint` 与 `npm run format` **不覆盖** `tests/*.mjs`，故测试代码需手工保证 Prettier 风格（无分号、双引号、printWidth 80）。

### 5.9 Node 测试运行器的坑

- `node --test tests/` 在本项目 Node v22.23.1 下会把目录当模块加载 → `MODULE_NOT_FOUND`
- 裸 `node --test`（无参数）默认模式 `**/test-*.js` 会误抓 legacy 文件 `functions/test-kv.js` → 多出 1 个假测试
- 且 glob 不匹配时报 **0 用例但退出码 0**（静默绿）→ 故加了 `pretest` 护栏（无测试文件时 exit 1）
- 正确写法（已固化在 `package.json`）：`node --test "tests/**/*.test.mjs"`

---

## 6. 验证命令清单（含预期输出）

```bash
# 1. 全量测试（约 25 秒，含构建）
npm test
#   预期：# tests 42 / # pass 42 / # fail 0，退出码 0

# 2. 类型与风格
npm run typecheck    # 无输出
npm run lint         # 无输出（注意：不覆盖 tests/*.mjs）

# 3. 构建确定性与函数体积
npm run build
#   预期末行：✅ build-edge.cjs fixed with safe join.（边缘函数 21.7 KB / 上限 5 MB）
ls -l 'edge-functions/[[default]].js'          # 应为 ~21.7 KB
ls dist/assets | grep '^index-'                 # 应为 index-CsZsNk6z.js / index-lsvc-_00.css

# 4. 连续两次构建必须同哈希
npm run build && ls dist/assets | grep '^index-'
npm run build && ls dist/assets | grep '^index-'   # 文件名应与上次完全一致

# 5. 线上验收（两个域名都要测）
curl -s https://textdb.hunluan.space/stats       # 生产：应返回 JSON
curl -s https://text.hunluan.space/stats         # 预发：应返回 JSON
curl -s https://textdb.hunluan.space/test-kv     # 应返回 {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' https://textdb.hunluan.space/favicon.ico   # 应为 204
curl -s https://textdb.hunluan.space/nonexistent_key_zzz   # 应为 200 + 空 body（函数行为）
#   ⚠️ 若返回平台 HTML 404 页（而非 JSON/空体），则函数未生效

# 6. 流水线校验（改动 .cnb.yml 后必做）
node /root/.codebuddy/skills/cnb-pipeline/validator/validate.js /workspace/.cnb.yml
#   预期：YAML 语法 + 语义通过；Schema 告警 19 条（均为 $: vscode 段存量问题，数量应与改动前一致）
```

### 查看流水线状态与日志（CNB CLI）

```bash
# 最近构建状态
cnb build get-build-logs --repo shisheng820/textdb-edgeone --sourceRef dev --page-size 3

# 下载 runner 完整日志（pipelineId 为 <sn>-001）
cnb build build-runner-download-log --repo shisheng820/textdb-edgeone --pipelineId <sn>-001
#   下载到 /tmp/cnb-api/*.bin，用 sed 's/\x1b\[[0-9;]*m//g' 去色后 grep 关键词
```

---

## 7. 待办事项（按优先级）

### T1 🔴 立即做：Phase 2 的线上运行时验证（计划 Task 2.4）

**为什么是阻塞项**：单元测试跑在 Node 的 WebCrypto 上，与 EdgeOne V8 运行时是**两套实现**。PBKDF2 的运行时可用性官方文档已确认（`deriveBits` 支持 ECDH/HKDF/PBKDF2），但**必须实测**。若运行时不可用或超时，密码功能会全线故障。

**步骤**：

```bash
# 1. 确认已部署（push dev 后等约 3 分钟看构建状态）
cnb build get-build-logs --repo shisheng820/textdb-edgeone --sourceRef dev --page-size 1

# 2. 在 preview 域名上实测 PBKDF2 全流程
B=https://text.hunluan.space
K="pbkdf2probe$(date +%s)"
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v1\",\"password\":\"pass1234\"}"     # 期望 {"status":1}
curl -s "$B/$K"                                                      # 期望 v1
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v2\",\"password\":\"pass1234\"}"     # 期望 {"status":1}
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v3\",\"password\":\"wrong\"}"        # 期望 400 Incorrect password
curl -s -X DELETE "$B/$K" -H 'X-Password: pass1234'                  # 清理
```

**判定**：
- ✅ 全部符合预期 → 删除试探 key，Phase 2 收尾，继续 T2
- ❌ 返回 500 / 超时 → **立即回退**（见第 9 节回退方案），并把结论写入 `REVIEW_TODO.md`

**还要做的**：验证存量密码未受影响——随机挑一个已设密码的 key（若有）确认可正常读取。

### T2 Phase 3：统一写/删路径密码来源优先级为 body 优先

**目标**：`build-edge.cjs` 中 `POST /update/` 的**删除**路径把 `X-Password || params.password` 改为 `params.password || X-Password`（与写入路径一致）。

⚠️ **注意**：计划原文的测试用例误用了 `DELETE /{key}` 来断言「body 优先」——该入口按规范**只认 header、不接受 body**，用例已修正为 `POST /update/` + `value:""`。计划的「前提修正」小节有完整说明，**务必先读**。

**必须保留 header 回退**（向后兼容），并补一条「仅用 `X-Password` 头仍可用」的测试。

### T3 Phase 4：`localStorage.setItem` 异常保护

位置：`src/App.tsx:37-40` 的导航持久化 `useEffect`。隐私模式 / 存储被禁用时 `setItem` 会抛错，而读取侧 `getInitialNav`（同文件 18-22 行）**已有** try/catch，写入侧缺失。补上即可。无 DOM 测试环境，人工浏览器验证。

### T4 最终验证（计划末尾的「最终验证」一节）

- 全量 `npm test` / `typecheck` / `lint` 通过
- 连续两次构建哈希一致
- 边缘函数体积在阈值内
- **把 `npm test` 接入 `.cnb.yml`**（计划里给了 YAML 片段：新增 `npm-test` 阶段）
- 部署后**两个域名**端到端复测（含密码全流程）
- `REVIEW_TODO.md` 逐项标注结果；`CHANGELOG.md` 追加条目

### T5 ⏳ 待用户决策：Phase 5（`sync-to-github` 的 `--force`）

**需要用户拍板**。计划里已补充的关键事实：同步有**两条**链路——自动（`.cnb.yml:162,164`，无条件 `--force`）与手动（web trigger，**已实现** `FORCE_PUSH` / `DRY_RUN` / `PUSH_BRANCH` / `PUSH_TAGS` 开关）。即 REVIEW_TODO #4 的建议在手动链路已实现，只差自动链路。

- **选项 A（推荐）**：保持自动 `--force`，在 `REVIEW_TODO.md` 标注「已确认预期行为」（CNB 为唯一真源、GitHub 为只读镜像）
- **选项 B**：自动链路也改为默认不快进则告警，仅 `FORCE_PUSH=true` 强推

### T6 ⏳ 待用户决策：Phase 6（首页 AI 爬虫死代码处置）

- **方案③（推荐）**：移除死代码（含 `AI_CRAWLERS` 常量与 `ai-crawler-agents.json` 的引入；**但保留该 json 文件本身**，数据源为 ai.robots.txt，未来可能复用）
- 方案①：`edgeone.json` 加 `headers` 声明 —— 无法实现条件分支，**达不成原目标**
- 方案②：删除 `dist/index.html` 静态副本改由函数唯一提供 —— **有破坏 SPA fallback 的风险**

详见计划 Phase 6 的三方案对比表。

### T7 ⏳ 发布：dev → master

⚠️ **前置条件：T1（Phase 2 运行时验证）必须先通过**（计划已标注这是 Phase 2 合并前的硬门槛，因为回退方案涉及已升级的 v2 记录）。

流程：等 T2/T3/T4 完成后，从 `dev` 发 PR 到 `master`（**不要强推**）。合并会触发**生产环境部署**，部署后立即用第 6 节的验收命令复测生产域名。

---

## 8. 关键决策记录

| 决策 | 理由 |
|---|---|
| **部署用「不传目录」方案 A** | 两种传参方式都有硬缺陷（见 5.2），只有不传路径才能同时拿到静态资源 + 函数 |
| **函数只内联 `index.html`** | 静态资源由平台 `filesystem` 托管，函数只兜底动态路径，无需内联；这也是唯一能满足 5 MB 上限的架构 |
| **CI 双阈值（5 MB 失败 / 256 KB 预警）** | 5 MB 是官方硬上限（不能改）；但仅靠它拦不住「误内联 dist 但未超限」（历史 705 KB 案例），故加预警线 |
| **保留 `functions/` 与 `edge-functions/` 三份产物** | CLI 只读 `edge-functions/`，`functions/` 是 legacy 回退路径。保留是历史约定，**未做清理**（避免改动引入风险）；已在 `AGENTS.md` 标注 |
| **master 用 fast-forward 合并** | master 无独有提交，ff 可零冲突，且保留线性历史 |
| **测试用 Node 内置 test runner** | 零新依赖；项目此前无测试框架，不宜一次引入 vitest/jest 这类重依赖 |
| **测试导入构建产物而非源码** | `build-edge.cjs` 是函数逻辑唯一真源，测产物等于测最终上线的东西 |
| **v1→v2 透明迁移（而非强制重置密码）** | 强烈避免存量用户失联；迁移只在**校验通过后**执行，失败不写回 |
| **删除路径不迁移** | 密码正确后元数据随即被删除，升级无意义 |
| **不再新增对 CNB 的外链** | 仓库私有，外链对访客是死链；CNB 保持私有是为保护构建日志中的密钥 |
| **`@source not` 排除 docs/tests/根 md** | 实测文档代码片段曾向 CSS 贡献 17 个 class → 改文档会改变前端产物哈希（同类缓存失效问题） |

---

## 9. 风险与回退

| 风险 | 触发条件 | 回退方案 |
|---|---|---|
| **PBKDF2 在 EdgeOne 运行时不支持或过慢** | T1 线上验证返回 500 / 超时 | 将 `PASSWORD_VERSION` 改回 1 并让 `setPasswordMeta` 用 `sha256Hex`；`hashForVersion` 的版本分支保留。⚠️ **回退前需先确认没有 v2 记录**（抽查 `TEXTDB.list({prefix:'tdb_'})` 中 `.pwd` 结尾的键）——这是唯一的兼容性硬缺口，**故 Phase 2 必须先通过线上验证才能合并 master** |
| 迁移逻辑导致存量密码失效 | Phase 2 上线后用户报「密码错误」 | v1 分支保证旧记录可校验；若仍异常，`git revert` 该提交（KV 元数据格式向后兼容，回退后 v2 记录会计为密码错误） |
| 恒定时间比较引入逻辑错误 | 密码用例失败 | 回退 `constantTimeEqual` 调用为直接比较（1 行改动，`build-edge.cjs` 两处） |
| 构建哈希漂移复发 | 连续两次构建文件名不同 | 检查 `src/index.css` 的 7 条 `@source not` 是否被删；检查工作区是否有未被 gitignore 的构建残留目录（如 `.Trash-0/`） |
| 函数体积超限 | CI 体积校验 FAIL | 检查 `build-edge.cjs` 的 `staticFiles` 是否误内联了 `dist/` 下的资源（应只有 `index.html`） |
| 死代码处置方案②破坏深链 | 方案②实施后 `/xxx` 深链 404 | 恢复 `dist/index.html` 静态副本（重新构建即可） |

---

## 10. 本会话的其它产物与遗留

### 已更新的文档

| 文档 | 内容 |
|---|---|
| `AGENTS.md` | 架构、命令、部署、测试架构、踩坑记录、官方限制表、密码来源三路径表 |
| `README.md` | 功能列表、命令、部署方案 A、踩坑记录、文档导航 |
| `CHANGELOG.md` | 新增 `Unreleased` 段（记录 A1/A2/A3 三个部署修复）；修正 v1.2.0 日期为 2026-07-13 |
| `ROADMAP.md` | 补「未发布」记录；更新日期 |
| `REVIEW_TODO.md` | 更新分支现状；修正第 5 项（密码来源三路径）与第 6 项（死代码结论）；挂上计划文件链接 |
| `docs/superpowers/plans/2026-09-15-review-todo-remediation.md` | 实施计划（本会话的执行依据） |

### 未处理项（有意为之，勿当成遗漏）

- `functions/` 与 `edge-functions/` 的三份重复产物未清理（历史约定，清理有风险）
- `functions/test-kv.js` 是未被使用的 legacy 文件（CLI 只读 `edge-functions/`），保留中
- `eslint` / `prettier` 未覆盖 `tests/*.mjs`（扩展需决定 `.mjs` 的规则集，超出本计划范围）
- `origin/backup-master-5b3cdd9` 等历史分支未删除
- 根目录 `.Trash-0/` 已被 `.gitignore` 忽略（删除操作残留，实测无法通过常规方式删除，但已不影响构建）

### 版本号

`package.json` 仍为 **1.3.0**，`CHANGELOG.md` 有 `Unreleased` 段。待 T2/T3/T4 完成、准备发版时，把 `Unreleased` 改名（如 `1.3.1` 或 `1.4.0`）并提升 `package.json` 版本号。

---

## 11. 附：本会话的提交清单（从 `8d3f696` 起，共 18 个）

```
ad10da6  feat(security): 密码哈希升级为 PBKDF2-SHA256(100k)，支持 v1 透明迁移（Phase 2）
76d67d0  test(docs): Phase 1 评审对齐——注释归因修正与计划状态同步
38f0b4d  refactor(edge): 密码哈希比较改为恒定时间（Phase 1）
5f0fd60  test: 质量复审残留修复（文档一致性 + 护栏递归化 + 规格对齐）
8bf3412  test: 补齐质量评审发现的测试缺口与文档同步
0d6cffd  docs(plan): 规格评审修正——测试用例规格与实现对齐
782f4d6  test: 建立边缘函数测试基线（Phase 0）
2724eec  docs(plan): 按 writing-plans skill 制定遗留事项整改计划
c3e8f3b  docs(plan): 制定 REVIEW_TODO 遗留事项整改实施计划
36ecf54  docs: 补记两个自定义域名的环境绑定关系
d8e0076  docs: 修正首页 AI 爬虫逻辑描述——实测为死代码
817c0ac  ci: 加入边缘函数代码包体积校验，按官方 5MB 上限拦截
62d27bc  chore(footer): 注释掉 CNB 仓库链接，仅对外暴露 GitHub 镜像
7a4a0c8  feat(footer): 页脚加入 CNB 仓库链接，三个外链各配官方 Logo
41b0fbd  docs: 全面更新文档，修正过时的部署/构建/运行时描述
032d90f  fix(build): 修复构建不确定——产物哈希每次变化导致缓存失效
9180ad1  fix(edge): 函数只内联 index.html，代码包 9.5MB → 19.6KB
b56f3a6  fix(deploy): 改走方案 A（CLI 自动构建），修复线上 API 404
```

其中 `b56f3a6` ~ `36ecf54` 已合入 `master` 并部署到生产；`c3e8f3b` 之后仅在 `dev`。
