# Dev 分支 Code Review 遗留 TODO

> 来源：dev → master 合并前 Code Review（2026-09-03）
> 状态：dev 已合并到 master，以下为评审中发现的**非阻断性**改进项，按优先级排期处理。

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
- **现状**：写入路径 `inputPwd = params.password || header`（body 优先）；删除路径 `header || params.password`（header 优先）
- **建议**：统一优先级（建议统一为 body 优先，与 API 文档 curl 示例一致）

### 6. `Vary: User-Agent` 缓存碎片化观察

- **位置**：`build-edge.cjs` 首页响应
- **现状**：为区分 AI 爬虫与普通用户，首页加了 `Vary: User-Agent`，CDN 会按 UA 生成多个缓存条目
- **建议**：上线后观察 EdgeOne 缓存命中率；如碎片化明显，可改为仅对爬虫 UA 设置 `Cache-Control: no-cache`，普通用户不设 Vary

---

## 已确认无需处理

- `_enc` 变量在 edge 产物中有定义（`const _enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;`），无 ReferenceError 风险
- 首次设置/修改/移除密码的时序逻辑正确（验证通过 → 写数据 → 改密码）
