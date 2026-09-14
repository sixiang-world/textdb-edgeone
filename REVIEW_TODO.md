# Dev 分支 Code Review 遗留 TODO

> 来源：dev → master 合并前 Code Review（2026-09-03）
> 状态：以下为评审中发现的**非阻断性**改进项，按优先级排期处理。
> **实施计划：** [docs/superpowers/plans/2026-09-15-review-todo-remediation.md](docs/superpowers/plans/2026-09-15-review-todo-remediation.md)
> （Phase 0-4 可实施，Phase 5-6 需先做决策；下方各项的处理状态随计划执行同步更新）
>
> **实施计划（2026-09-15 制定）：** [`docs/superpowers/plans/2026-09-15-review-todo-remediation.md`](docs/superpowers/plans/2026-09-15-review-todo-remediation.md)
> —— 含 6 个 Phase、逐任务可执行步骤、测试基线方案（Node 内置 test runner，零依赖）、
> 风险回退表与完成定义。其中 Phase 5 / Phase 6 需先做决策，Phase 0-4 可直接实施。
>
> 分支现状（2026-09-14 更新）：当时误把 dev 内容合并进 master（合并请求 #4），已回退——
> master 现位于 `8d3f696`，误合并的那份备份在分支 `backup-master-5b3cdd9`。
> dev 目前领先 master 若干部署相关修复（见 CHANGELOG.md 的 Unreleased），
> 需要发生产时正常合一次 PR 到 master 即可，**不要强推**。

## 优先级说明

- **P1 安全加固**：影响安全性，建议尽快处理
- **P2 健壮性**：极端场景可能出问题
- **P3 一致性/优化**：不影响功能，纯改进

---

## P1 安全加固

### 1. 密码哈希升级为慢哈希算法

- **位置**：`build-edge.cjs` 中 `sha256Hex()` / `setPasswordMeta()`
- **现状**：密码用 `SHA-256(随机盐 + 密码)` 存储，SHA-256 计算速度快，离线暴力破解成本低
- **建议**：改用 WebCrypto 原生支持的 **PBKDF2**（`crypto.subtle.importKey` + `deriveBits`，迭代次数 ≥ 100k），或引入 bcrypt/argon2 库
- **注意**：Edge Functions（V8）支持 WebCrypto 的 PBKDF2，无需 npm 依赖；但改动会影响已存密码的校验，需考虑**迁移策略**（版本字段 `v:1` 已预留，可做版本化哈希）

### 2. 密码哈希比较改为恒定时间

- **位置**：`build-edge.cjs` 中 `checkPassword()` / `verifyDeletePassword()`
- **现状**：`hash === meta.h` 字符串比较，理论上存在时序侧信道
- **建议**：逐字节异或累计比较，避免提前返回（Edge Functions 无现成 constantTimeEquals，需手写）

---

## P2 健壮性

### 3. `localStorage.setItem` 缺少异常保护

- **位置**：`src/App.tsx` 中导航持久化 `useEffect`
- **现状**：读取时有 `try/catch` 降级（`getInitialNav`），但写入时 `localStorage.setItem` 未包裹，隐私模式/存储禁用时会抛错
- **建议**：`setItem` 同样包一层 `try/catch`，静默降级

### 4. 自动版 GitHub 同步使用 `--force` 推送

- **位置**：`.cnb.yml` 中 `.sync-github` 锚点的 `push-branch-and-tags` stage
- **现状**：`git push github "${BRANCH}" --force`，CNB 作为源头会强制覆盖 GitHub 对应分支历史
- **建议**：确认这是预期行为（CNB 为唯一真源）；如不是，去掉自动版的 `--force`，仅在手动触发时按 `FORCE_PUSH` 变量控制

---

## P3 一致性/优化

### 5. 写/删路径密码来源优先级不一致

- **位置**：`build-edge.cjs` 的 `handleApi()`
- **现状（2026-09-15 逐行核实，含此前未记录的第三条路径）**：

  | 入口 | 代码位置 | 密码来源 |
  |---|---|---|
  | `POST /update/` 写入/更新 | `:177` | `params.password \|\| X-Password`（**body 优先**） |
  | `POST /update/` 删除（`value` 为空串） | `:155,161` | `X-Password \|\| params.password`（**header 优先**） |
  | `DELETE /{key}` | `:233` | 仅 `X-Password`（body 被忽略） |

- **不一致范围**：仅前两条（同为 `/update/` 入口却优先级相反）。第三条 `DELETE /{key}` 只读 header 是**符合规范**的——`public/openapi.json` 的该操作只声明 `XPassword` 头参数、无 requestBody，**不属缺陷，无需改**
- **影响**：前端 `src/api.ts` 的 `deleteData()` 走第二条且只在 body 传密码，故前端功能正常；仅 API 直接调用时同一入口的写/删行为不一致
- **建议**：统一前两条为 body 优先（与 API 文档 curl 示例一致）。详见计划 Phase 3

### 6. 首页 AI 爬虫逻辑是死代码（2026-09-14 实测确认，结论已更新）

- **位置**：`build-edge.cjs` 中 `onRequest` 的 `if (path === '/' || path === '/index.html')` 分支
- **现状**：该分支为区分 AI 爬虫与普通用户设置 `Vary: User-Agent`，并对爬虫返回 `Cache-Control: no-cache, private`。**但实测该分支从不执行**——`routes.json` 中 `{handle:"filesystem"}` 优先于函数，而 `dist/index.html` 是真实存在的静态文件，因此 `/` 与 `/index.html` 由平台静态托管直接返回
- **证据**：真实响应头为平台默认的 `Vary: Origin, Access-Control-Request-Headers, Access-Control-Request-Method` 与 `Cache-Control: public,max-age=0,must-revalidate`（含平台计算的 `Etag`），**不含** `Vary: User-Agent`；无对应静态文件的路径（`/md/*`、`/stats`、`/p/*`）则走函数且无 `Vary` 头
- **影响**：有限——静态 `index.html` 本身已内嵌 JSON-LD（AI 爬虫仍能读到正确内容），只是"给爬虫更短的缓存"这一意图未实现
- **建议**：若要真正生效，有三条路——① 用 `edgeone.json` 的 `headers`/`rewrites` 声明；② 删除 `dist/index.html` 静态副本改由函数唯一提供（需确认平台不会因此退化 SPA fallback）；③ 直接移除这段死代码，避免误导。**决策前先不要动**，另注意原第 6 项的"缓存碎片化"担忧因此不成立

---

## 已确认无需处理

- `_enc` 变量在 edge 产物中有定义（`const _enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;`），无 ReferenceError 风险
- 首次设置/修改/移除密码的时序逻辑正确（验证通过 → 写数据 → 改密码）
