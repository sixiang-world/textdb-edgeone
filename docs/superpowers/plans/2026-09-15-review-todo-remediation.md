# REVIEW_TODO 遗留事项整改 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **配套需求来源：** `REVIEW_TODO.md`（6 项遗留：2 项 P1 安全 / 2 项 P2 健壮性 / 2 项 P3 一致性）
> **Goal:** 修复 6 项 Code Review 遗留问题（2 项安全加固、2 项健壮性、2 项一致性/决策），并为边缘函数建立可回归的测试基线
> **Architecture:** 先建测试基线（Phase 0，后续每个 Phase 都靠它做 TDD），再按「低风险 → 高风险」推进；每项改动的后端逻辑集中在 `build-edge.cjs`，前端仅 Phase 4 动一处
> **Tech Stack:** Node.js 内置 test runner（零依赖）+ WebCrypto PBKDF2 + edgeone CLI 部署
> **状态：** 待执行（Phase 0-4 可直接实施；Phase 5-6 需先做决策）
>
> 注：本仓库的计划统一存放于 `docs/superpowers/plans/`（沿用项目既有约定，与另外 5 份历史计划一致）。
>
> **先决条件（执行前必须满足）：**
> - 已安装 Node.js 22+（`node -v`）
> - 处于 `dev` 分支且工作区干净（`git status` 无输出）
> - 已执行 `npm install`（edgeone CLI 需在 devDependencies 中）
> - 当前基线：`npm run typecheck` / `npm run lint` / `npm test` 均可运行（`npm test` 在 Phase 0 之前会失败，属预期）

---

## 前置结论（已实测/查证，作为计划依据）

| 结论 | 证据 |
|---|---|
| 边缘函数产物可被 Node 直接 `import` 并测试，**零依赖** | 原型 `tests` 跑通 5/5：`import(pathToFileURL('edge-functions/[[default]].js'))` 后调用 `onRequest({request, env})`，`package.json` 已是 `"type":"module"` |
| **PBKDF2 官方支持**（`importKey` + `deriveBits`/`deriveKey` 是仅有的 3 种派生算法之一：ECDH/HKDF/PBKDF2） | https://edgeone.ai/zh/document/52693 |
| PBKDF2 100k 迭代耗时 **12.3 ms**，远低于 **200 ms** CPU 上限（占 6%） | 本机实测；SHA-256 单次 0.070 ms（对比 176 倍强度差距） |
| 版本化哈希迁移方案可行：v1 记录用旧算法校验通过后**透明升级**为 v2 | 原型验证：正确密码 → 升级（含 `v:2,i,u` 字段）；错误密码 → 不写入 |
| `edgeone.json` 支持 `headers` / `redirects` / `rewrites` / `env` 等字段 | CLI schema 提取（Phase 6 方案①的依据） |
| 写/删路径密码优先级不一致的**精确位置** | `build-edge.cjs:167` 写入 `params.password \|\| header`（body 优先）vs `build-edge.cjs:151` 删除 `header \|\| params.password`（header 优先） |
| 前端删除走 **body 传密码**（`src/components/*` 用 `deleteData(key, pwd)` → JSON body） | 因此删除路径的 `header` 优先在实际调用中不会触发；但 API 直接调用时行为不一致 |
| GitHub 同步有**两条**链路，手动链路**已实现** `FORCE_PUSH` 开关 | `.cnb.yml:158-164`（自动，无条件 `--force`）vs `.cnb.yml:278-327`（手动，含 `FORCE_PUSH`/`DRY_RUN`/`PUSH_BRANCH`/`PUSH_TAGS`） |
| `src/App.tsx:37-40` 的 `localStorage.setItem` 无保护，而读取侧 `getInitialNav`（18-24 行）已有 try/catch | 即 REVIEW_TODO 第 3 项描述的现状准确 |

---

## File Structure（变更总览）

```
tests/                                  # [新] 测试基线（零依赖）
├── helpers.mjs                         # [新] KV mock + onRequest 调用封装（含并发约束说明）
├── api.test.mjs                        # [新] API 行为基线（12 项）
├── helpers.test.mjs                    # [新] KV mock 自身语义（分页/前缀）——它是所有测试的"预言机"
├── stats.test.mjs                      # [新] /stats 分页累加、扫描上限、故障降级（7 项）
└── password.test.mjs                   # [新] Phase 2 密码流程 + 迁移测试
build-edge.cjs                          # [改] 恒定时间比较 / PBKDF2 / 版本化迁移 / 密码优先级统一
src/App.tsx                             # [改] localStorage.setItem 加 try/catch
src/index.css                           # [改] 追加 @source not "../*.md"（根 markdown 防御性排除）
package.json                            # [改] 新增 test + pretest 脚本
AGENTS.md / README.md                   # [改] Commands 补 npm test，新增「测试架构」章节
.cnb.yml                                # [改] verify 阶段接 npm test
REVIEW_TODO.md                          # [改] 逐项标记处理结果
CHANGELOG.md                            # [改] 追加条目
```

**关键约束**：`build-edge.cjs` 是函数逻辑的**唯一真源**，测试导入的是它生成的产物 `edge-functions/[[default]].js`。因此每次改完必须 `npm run build` 再测（`npm test` 脚本已内置）。

---

## Phase 0：测试基线（TDD 前提）⏳ 待执行

> 为什么必须先做：Phase 1-3 都改密码逻辑，而这是**用户数据的访问控制**，没有回归测试就改动风险过高。项目目前无任何测试框架，此 Phase 用 Node 内置 test runner 补上，**零新依赖**。

### Task 0.1：创建 KV mock 与调用封装

**Files:**
- Create: `tests/helpers.mjs`
- Reference: `package.json`（`"type":"module"` 已存在，无需改动）

- [ ] 创建 `tests/helpers.mjs`：

```js
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 测试基础设施：内存 KV + 边缘函数调用封装。
 *
 * ⚠️ 并发约束（勿删）：边缘函数在 `onRequest` 入口把 `context.env.TEXTDB` 写入
 * `globalThis.TEXTDB`（进程内共享的模块级状态），因此 **同一测试文件内的用例必须串行执行**
 * ——这也是 Node 测试运行器的默认行为。不要给 `test()` / `describe()` 开启 `concurrency`，
 * 否则并发请求会互相覆盖 KV 绑定，产生偶发串扰。
 * （不同测试文件由 `node --test` 以独立子进程运行，互不影响，无需担心跨文件干扰。）
 *
 * ⚠️ 隔离约定：每个用例必须各自调用 `makeKV()` 创建独立实例，不要共享。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FN_PATH = resolve(ROOT, "edge-functions/[[default]].js");

/** 内存 KV，接口与 EdgeOne KV 一致（get/put/delete/list） */
export function makeKV(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    /** 测试专用出口：直接检视底层存储（断言写入/删除是否落库） */
    store,
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async put(k, v) {
      store.set(k, typeof v === "string" ? v : String(v));
    },
    async delete(k) {
      store.delete(k);
    },
    async list({ prefix = "", limit = 256, cursor } = {}) {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? all.indexOf(cursor) + 1 : 0;
      const page = all.slice(start, start + limit);
      const complete = start + limit >= all.length;
      return {
        complete,
        cursor: complete ? undefined : page[page.length - 1],
        keys: page.map((key) => ({ key })),
      };
    },
  };
}

let _handler = null;
/** 加载处理器（仅首次真正 import） */
export async function loadHandler() {
  if (!_handler) _handler = (await import(pathToFileURL(FN_PATH).href)).onRequest;
  return _handler;
}

/** 以 (path, RequestInit) 形式调用 onRequest */
export async function call(kv, path, init) {
  const onRequest = await loadHandler();
  return onRequest({
    request: new Request(`https://example.test${path}`, init),
    env: { TEXTDB: kv },
  });
}

/** JSON 请求快捷方式 */
export function jsonInit(body, extraHeaders = {}) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export const readJSON = async (r) => JSON.parse(await r.text());
```

- [ ] 验证导入路径正确：`node -e "import('./tests/helpers.mjs').then(m=>console.log(Object.keys(m)))"` → 应输出 `[ 'makeKV', 'loadHandler', 'call', 'jsonInit', 'readJSON' ]`

### Task 0.2：API 行为基线测试

**Files:**
- Create: `tests/api.test.mjs`
- Modify: `package.json`（新增 `test` 脚本）
- Test: `npm test`（`npm run build && node --test "tests/**/*.test.mjs"`）

> ⚠️ 执行时的两处实测修正（已落地，勿改回）：
> 1. 不能用 `node --test tests/` —— 该形式在本项目 Node v22.23.1 下会把目录当模块加载而报 `MODULE_NOT_FOUND`
> 2. 也不能用裸 `node --test`（无参数）—— 其默认模式 `**/test-*.js` 会误抓 legacy 文件 `functions/test-kv.js`，导致多出 1 个假测试
> 3. 因此固定为显式 glob `"tests/**/*.test.mjs"`（Node 自身展开，不依赖 shell）

- [ ] 创建 `tests/api.test.mjs`，覆盖当前**已确认正常**的行为（锁死基线，防后续改动引入回归）：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { makeKV, call, jsonInit, readJSON } from "./helpers.mjs";

test("写入后读取：往返一致", async () => {
  const kv = makeKV();
  const w = await call(kv, "/update/", jsonInit({ key: "t1", value: "hello" }));
  assert.equal(w.status, 200);
  assert.equal((await readJSON(w)).status, 1);
  const r = await call(kv, "/t1");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "hello");
});

test("KV 前缀：写入落在 tdb_ 命名空间", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "t2", value: "v" }));
  assert.ok(kv.store.has("tdb_t2"), "应写入 tdb_t2");
});

test("非法 key 返回 400", async () => {
  const kv = makeKV();
  const r = await call(kv, "/update/", jsonInit({ key: "bad-key!!", value: "x" }));
  assert.equal(r.status, 400);
});

test("不存在的 key：200 且空 body（非 404）", async () => {
  const kv = makeKV();
  const r = await call(kv, "/nonexistent");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "");
});

test("超大 value 返回 413", async () => {
  const kv = makeKV();
  const big = "x".repeat(5 * 1024 * 1024 + 1);
  const r = await call(kv, "/update/", jsonInit({ key: "big", value: big }));
  assert.equal(r.status, 413, "超过 5 MiB 应返回 413");
});

test("OPTIONS 返回 204 且带 CORS 头", async () => {
  const kv = makeKV();
  const r = await call(kv, "/update/", { method: "OPTIONS" });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
});

test("空 value 触发删除", async () => {
  const kv = makeKV({ tdb_del: "content" });
  const r = await call(kv, "/update/", jsonInit({ key: "del", value: "" }));
  assert.equal(r.status, 200);
  assert.equal((await readJSON(r)).data.action, "deleted");
  assert.ok(!kv.store.has("tdb_del"), "KV 中应已删除");
});

test("/stats 汇总键数与体积", async () => {
  const kv = makeKV();
  await call(kv, "/t1", { method: "POST", body: "abc" });
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.status, 1);
  assert.equal(j.data.totalKeys, 1);
});

test("/p/ 返回 HTML 且带 CSP", async () => {
  const kv = makeKV({ tdb_h: "<h1>hi</h1>" });
  const r = await call(kv, "/p/h");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.match(r.headers.get("Content-Security-Policy") || "", /script-src/);
});

test("/file/html/ 拒绝渲染", async () => {
  const kv = makeKV({ tdb_h: "<h1>hi</h1>" });
  const r = await call(kv, "/file/html/h");
  assert.equal(r.status, 400);
});

test("/md/ 返回 SPA 外壳", async () => {
  const kv = makeKV({ tdb_m: "# Title" });
  const r = await call(kv, "/md/m");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<html/i);
});

test("DELETE 删除无密码保护的 key", async () => {
  const kv = makeKV({ tdb_d: "v" });
  const r = await call(kv, "/d", { method: "DELETE" });
  assert.equal(r.status, 200);
  assert.ok(!kv.store.has("tdb_d"));
});
```

- [ ] 加 `package.json` 脚本：`"test": "npm run build && node --test \"tests/**/*.test.mjs\""`
- [ ] 运行 `npm test` → **预期 12 项全通过**（这些都是当前已正确的行为）
- [x] 已完成：12/12 通过，退出码 0

> 规格评审修正（2026-09-15）：上方「超大 value 返回 413」用例已按实际实现更新为「抽取 `big` 中间变量 + 自定义断言消息」的形式。原规格为单行内联表达式且无断言消息；改动理由是可读性与失败时的可诊断性（该断言涉及 5 MiB 数据，写明期望值便于排查）。语义等价，不影响覆盖率。
>
> **代码质量评审修正（2026-09-15）**：质量评审判定 "With fixes"，4 项 Important 已全部处理——
> 1. `/stats` 分页与 `MAX_SCAN_KEYS` 上限**原本无任何覆盖** → 新增 `tests/stats.test.mjs`（7 项，含 256/257/1000/4999/5000+ 边界、内部 key 不计入、KV 故障降级）+ `tests/helpers.test.mjs`（5 项，自证 mock 分页语义）
> 2. `globalThis.TEXTDB` 是进程内共享状态 → 在 `tests/helpers.mjs` 顶部写明「同一文件内用例必须串行、勿开 concurrency」，并在 AGENTS.md 记录
> 3. `_store` 以下划线命名却作公开测试接口 → 重命名为 `store` 并加注释说明用途
> 4. `AGENTS.md` / `README.md` 仍写「没有测试框架」与事实矛盾 → 补 `npm test` 并新增「测试架构」章节
>
> 额外加固（评审 Minor 项衍生）：
> - `package.json` 加 `pretest` 护栏——实测 `node --test` 在 glob 不匹配时会**报 0 用例但退出码 0**（静默绿），对本项目此类"CI 绿但线上挂"的历史问题尤其危险，故无测试文件时直接 exit 1
> - `src/index.css` 追加 `@source not "../*.md"`——根目录 markdown 也被 Tailwind 扫描，实测当前未贡献 class，属防御性排除

> 已知限制（实测确认，暂不处理）：`eslint.config.js` 只匹配 `**/*.{ts,tsx}`，`npm run lint` **不覆盖** `tests/*.mjs`；`npm run format` 的 glob 同样只含 `{ts,tsx}`。若将来需要，可扩展 eslint `files` 与 format glob，但会引入对 `.mjs` 的规则集选择问题，本计划范围外。

> ⚠️ 若某项失败，说明我对基线行为的理解有误——**先修正测试再继续**，不要改实现。

---

## Phase 1：密码哈希比较改为恒定时间（P1-2）⏳ 待执行

> 「恒定时间比较」是**重构**，不改变可观测行为，因此本 Phase 用 Phase 0 的测试做**回归护栏**：先让测试全绿，重构后必须仍全绿（TDD 的 red→green→refactor 中的 refactor 阶段）。

### Task 1.1：新增 constantTimeEqual

**Files:**
- Modify: `build-edge.cjs`（在 `sha256Hex` 之后、`checkPassword` 之前插入）
- Regenerate: `edge-functions/[[default]].js`（经 `npm run build`）
- Test: `npm test`（回归护栏：改动前后都必须全绿）

- [ ] 在 `build-edge.cjs` 的 `sha256Hex`（第 85 行 `"}"`,）之后插入：

```js
  "// 恒定时间比较：避免因提前返回泄露哈希前缀信息（Edge Functions 无现成实现）",
  "function constantTimeEqual(a, b) {",
  "  if (typeof a !== 'string' || typeof b !== 'string') return false;",
  "  if (a.length !== b.length) return false;",
  "  let diff = 0;",
  "  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);",
  "  return diff === 0;",
  "}",
```

> 注：长度不等时直接返回 false 是可接受的——哈希长度固定为 64 字符（hex），长度本身不构成敏感信息。

### Task 1.2：替换两处比较

- [ ] `build-edge.cjs:98`：`"  return hash === meta.h;",` → `"  return constantTimeEqual(hash, meta.h);",`
- [ ] `build-edge.cjs:117`：`"  if (hash !== meta.h) return 'Incorrect password';",` → `"  if (!constantTimeEqual(hash, meta.h)) return 'Incorrect password';",`

### Task 1.3：验证

- [ ] `npm run build` → 观察输出 `✅ build-edge.cjs fixed with safe join.（边缘函数 NN KB / 上限 5 MB）`
- [ ] `npm test` → **12 项全通过**（无行为变化）
- [ ] 确认产物中无残留字符串比较：`grep -c "hash === meta.h\|hash !== meta.h" 'edge-functions/[[default]].js'` → **0**
- [ ] 提交：`git commit -m "refactor(edge): 密码哈希比较改为恒定时间实现"`

---

## Phase 2：密码哈希升级为 PBKDF2 + 版本化迁移（P1-1）⏳ 待执行

> 这是本次风险最高的一项改动（涉及已存密码的校验）。**迁移必须向后兼容**：已存 `v:1` 记录继续可用，校验通过后透明升级为 `v:2`。

### Task 2.1：先写失败测试（TDD red）

**Files:**
- Create: `tests/password.test.mjs`

- [ ] 创建 `tests/password.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { makeKV, call, jsonInit, readJSON } from "./helpers.mjs";

const PWD_KEY = (k) => `tdb_${k}.pwd`;

test("设密码后元数据为 v2 且含迭代次数", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "p", value: "v1", password: "pass1234" }));
  const meta = JSON.parse(kv.store.get(PWD_KEY("p")));
  assert.equal(meta.v, 2, "新密码应为 v2 格式");
  assert.equal(meta.i, 100000, "应记录迭代次数，便于后续提升");
  assert.ok(meta.s, "应有盐");
  assert.ok(meta.h, "应有哈希");
});

test("v2 记录：正确密码通过 / 错误密码被拒", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "p", value: "v1", password: "pass1234" }));
  const ok = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: "pass1234" }));
  assert.equal(ok.status, 200);
  const bad = await call(kv, "/update/", jsonInit({ key: "p", value: "v3", password: "wrong" }));
  assert.equal(bad.status, 400);
});

test("v1 旧记录：正确密码可校验（向后兼容）", async () => {
  // 用旧算法预置一条 v1 记录
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = btoa(String.fromCharCode(...saltBytes));
  const pwdBytes = new TextEncoder().encode("legacy123");
  const combined = new Uint8Array(saltBytes.length + pwdBytes.length);
  combined.set(saltBytes);
  combined.set(pwdBytes, saltBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const h = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const kv = makeKV({
    tdb_old: "legacy-value",
    [PWD_KEY("old")]: JSON.stringify({ h, s: salt, v: 1 }),
  });
  const r = await call(kv, "/update/", jsonInit({ key: "old", value: "updated", password: "legacy123" }));
  assert.equal(r.status, 200, "旧密码应仍可校验通过");
});

test("v1 记录校验通过后透明升级为 v2", async () => {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = btoa(String.fromCharCode(...saltBytes));
  const pwdBytes = new TextEncoder().encode("legacy123");
  const combined = new Uint8Array(saltBytes.length + pwdBytes.length);
  combined.set(saltBytes);
  combined.set(pwdBytes, saltBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const h = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const kv = makeKV({
    tdb_old2: "v",
    [PWD_KEY("old2")]: JSON.stringify({ h, s: salt, v: 1 }),
  });
  await call(kv, "/update/", jsonInit({ key: "old2", value: "new", password: "legacy123" }));
  const meta = JSON.parse(kv.store.get(PWD_KEY("old2")));
  assert.equal(meta.v, 2, "通过校验后应升级到 v2");
  assert.equal(meta.i, 100000);
  assert.ok(meta.u, "应记录升级时间戳");
});

test("v1 记录：错误密码不得触发升级（防降级/防污染）", async () => {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = btoa(String.fromCharCode(...saltBytes));
  const pwdBytes = new TextEncoder().encode("legacy123");
  const combined = new Uint8Array(saltBytes.length + pwdBytes.length);
  combined.set(saltBytes);
  combined.set(pwdBytes, saltBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const h = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const original = JSON.stringify({ h, s: salt, v: 1 });
  const kv = makeKV({ tdb_old3: "v", [PWD_KEY("old3")]: original });
  const r = await call(kv, "/update/", jsonInit({ key: "old3", value: "x", password: "WRONG" }));
  assert.equal(r.status, 400);
  assert.equal(kv.store.get(PWD_KEY("old3")), original, "元数据不应被改动");
});

test("改密码：旧密码校验 + 新密码生效", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "c", value: "v1", password: "pass1234" }));
  const r = await call(
    kv,
    "/update/",
    jsonInit({ key: "c", value: "v2", password: "pass1234", new_password: "newpass99" })
  );
  assert.equal(r.status, 200);
  const oldTry = await call(kv, "/update/", jsonInit({ key: "c", value: "v3", password: "pass1234" }));
  assert.equal(oldTry.status, 400, "旧密码应失效");
  const newTry = await call(kv, "/update/", jsonInit({ key: "c", value: "v3", password: "newpass99" }));
  assert.equal(newTry.status, 200, "新密码应生效");
});

test("删除：无密码拒绝 / 正确密码通过", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "d", value: "v1", password: "pass1234" }));
  const noPwd = await call(kv, "/d", { method: "DELETE" });
  assert.equal(noPwd.status, 400);
  const ok = await call(kv, "/d", { method: "DELETE", body: JSON.stringify({ password: "pass1234" }) });
  assert.equal(ok.status, 200);
});
```

- [ ] 运行 `npm test` → **预期 3 项失败**（`v2` / 升级 / 时间戳相关），其余通过 → 这就是 TDD 的 red

### Task 2.2：实现 PBKDF2 与版本化校验

**Files:**
- Modify: `build-edge.cjs:93-99`（`checkPassword` → 版本感知 + 透明升级）
- Modify: `build-edge.cjs:101-106`（`setPasswordMeta` → 写 v2）
- Modify: `build-edge.cjs:112-119`（`verifyDeletePassword` → 版本感知）
- Modify: `build-edge.cjs`（`sha256Hex` 之后插入 `PASSWORD_VERSION` / `PBKDF2_ITERATIONS` / `pbkdf2Hex` / `hashForVersion`）

- [ ] 在 `build-edge.cjs` 的 `sha256Hex` 之后插入：

```js
  "// --- v2: PBKDF2-SHA256（官方支持 deriveBits；100k 迭代实测 12.3ms，CPU 上限 200ms）---",
  "const PASSWORD_VERSION = 2;",
  "const PBKDF2_ITERATIONS = 100000;",
  "",
  "async function pbkdf2Hex(saltB64, password, iterations) {",
  "  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));",
  "  const keyMaterial = await crypto.subtle.importKey('raw', _pwdEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);",
  "  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iterations || PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);",
  "  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');",
  "}",
  "",
  "async function hashForVersion(version, salt, password, iterations) {",
  "  return Number(version) === 2 ? pbkdf2Hex(salt, password, iterations) : sha256Hex(salt, password);",
  "}",
```

- [ ] 把 `build-edge.cjs:101-106` 的 `setPasswordMeta` 改为写 v2：

```js
  "async function setPasswordMeta(key, password) {",
  "  if (String(password).length < 4 || String(password).length > 128) throw new Error('Password must be 4-128 characters');",
  "  const salt = generateSalt();",
  "  const hash = await pbkdf2Hex(salt, password);",
  "  await TEXTDB.put(passwordKey(key), JSON.stringify({h: hash, s: salt, v: PASSWORD_VERSION, i: PBKDF2_ITERATIONS}));",
  "}",
```

- [ ] 把 `build-edge.cjs:93-99` 的 `checkPassword` 改为版本感知 + 透明升级：

```js
  "async function checkPassword(key, password, existingMeta) {",
  "  if (!password) return false;",
  "  const meta = existingMeta || await getPasswordMeta(key);",
  "  if (!meta) return false;",
  "  const hash = await hashForVersion(meta.v, meta.s, password, meta.i);",
  "  if (!constantTimeEqual(hash, meta.h)) return false;",
  "  // v1 → v2 透明升级（仅在密码校验通过后执行，失败不写回）",
  "  if (Number(meta.v) !== PASSWORD_VERSION) {",
  "    try {",
  "      const upgraded = {h: await pbkdf2Hex(meta.s, password), s: meta.s, v: PASSWORD_VERSION, i: PBKDF2_ITERATIONS, u: Date.now()};",
  "      await TEXTDB.put(passwordKey(key), JSON.stringify(upgraded));",
  "    } catch (_) { /* 升级失败不影响本次校验结果 */ }",
  "  }",
  "  return true;",
  "}",
```

- [ ] 把 `build-edge.cjs:112-119` 的 `verifyDeletePassword` 同样改为版本感知：

```js
  "async function verifyDeletePassword(key, inputPwd) {",
  "  const meta = await getPasswordMeta(key);",
  "  if (!meta) return null; // no password, proceed",
  "  if (!inputPwd) return 'Password required';",
  "  const hash = await hashForVersion(meta.v, meta.s, inputPwd, meta.i);",
  "  if (!constantTimeEqual(hash, meta.h)) return 'Incorrect password';",
  "  return null; // verified OK",
  "}",
```

> 说明：删除路径**不做**透明升级（用户没提供正确密码时无从升级）；若删除时密码正确，元数据随后即被 `removePasswordMeta` 删除，升级无意义。

### Task 2.3：验证（TDD green）

- [ ] `npm test` → **全部通过**（Phase 0 的 12 项 + Phase 2 的 7 项）
- [ ] `npm run typecheck && npm run lint` → 通过
- [ ] 性能确认：产物内 PBKDF2 迭代数为 100000，`grep -c "PBKDF2_ITERATIONS = 100000" 'edge-functions/[[default]].js'` → 1
- [ ] 提交：`git commit -m "feat(security): 密码哈希升级为 PBKDF2-SHA256(100k)，支持 v1 透明迁移"`

### Task 2.4：线上验证（部署后必做）

> 单元测试用 Node 的 WebCrypto，与 EdgeOne 运行时是两套实现；**PBKDF2 的运行时可用性必须在真实环境确认**（官方文档已确认支持，但仍需实测）。

- [ ] 推送到 `dev`，等待 preview 部署成功
- [ ] 在 preview 域名上验证：

```bash
B=https://text.hunluan.space
K="pbkdf2probe$(date +%s)"
# 1) 新密码应为 v2（PBKDF2）且能正常读写
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v1\",\"password\":\"pass1234\"}"
curl -s "$B/$K"                                  # 期望 v1
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v2\",\"password\":\"pass1234\"}"   # 期望 status:1
curl -s -X POST "$B/update/" -H 'Content-Type: application/json' \
  -d "{\"key\":\"$K\",\"value\":\"v3\",\"password\":\"wrong\"}"      # 期望 400 Incorrect password
curl -s -X DELETE "$B/$K" -H 'X-Password: pass1234'                 # 清理
```

- [ ] **若返回 500 或超时** → PBKDF2 在运行时不可用/过慢，**立即回退**（见「风险与回退」）
- [ ] 确认存量密码未受影响：随机挑一个已设密码的 key 验证可正常读取

---

## Phase 3：统一写/删路径密码来源优先级（P3-5）⏳ 待执行

> 决策：**统一为 body 优先**。理由——`public/openapi.json` 的示例与前端调用均以 body 为主，header 仅作补充。

### 前提修正（2026-09-15 逐行核实，此前记载有误）

实际有**三条**密码路径，且 `DELETE /{key}` 的行为**符合规范、不是缺陷**：

| 入口 | 代码位置 | 密码来源 | 是否属本 Phase 范围 |
|---|---|---|---|
| `POST /update/` 写入/更新 | `build-edge.cjs:177` | `params.password \|\| X-Password`（body 优先） | 参照基准，不改 |
| `POST /update/` 删除（`value` 为空串） | `build-edge.cjs:155,161` | `X-Password \|\| params.password`（header 优先） | ✅ **本 Phase 唯一要改的目标** |
| `DELETE /{key}` | `build-edge.cjs:233` | 仅 `X-Password` | ❌ 不改——`public/openapi.json` 的该操作只声明 `XPassword` 头参数、**无 requestBody**，故实现只读 header 是符合规范的 |

> 因此 Task 3.1 的测试**不能**用 `DELETE /{key}` 来断言「body 优先」——该入口本就不接受 body 密码（`tests/password.test.mjs` 已有用例锁死这一点）。必须改用 `POST /update/` + `value:""` 这条前端实际使用的删除路径。
>
> 另注：`src/api.ts` 的 `deleteData()` 走的正是 `POST /update/` + `value:""` + body 传密码，因此本次统一**不会影响前端行为**（前端本来就只在 body 传）。

### Task 3.1：先写失败测试

**Files:**
- Modify: `tests/password.test.mjs`（追加用例）

- [ ] 在 `tests/password.test.mjs` 追加：

```js
test("密码来源：/update/ 的写路径与删路径均以 body 优先", async () => {
  const kv = makeKV({ tdb_pr: "v" });
  // 先设密码 A
  await call(kv, "/update/", jsonInit({ key: "pr", value: "v1", password: "passA" }));

  // 写路径：body 正确 + header 错误 → body 优先，应成功
  const w = await call(
    kv,
    "/update/",
    jsonInit({ key: "pr", value: "v2", password: "passA" }, { "X-Password": "WRONG" })
  );
  assert.equal(w.status, 200, "写路径应 body 优先");

  // 删路径（POST /update/ + 空 value）：body 正确 + header 错误 → 应成功
  // 当前实现是 header 优先，故这一步会失败 —— 即本 Phase 要修的缺陷
  const d = await call(
    kv,
    "/update/",
    jsonInit({ key: "pr", value: "", password: "passA" }, { "X-Password": "WRONG" })
  );
  assert.equal(d.status, 200, "删路径应 body 优先（与写路径一致）");
});
```

- [ ] `npm test` → **预期失败**于删除路径断言（当前 `header || body`）

### Task 3.2：实现

**Files:**
- Modify: `build-edge.cjs:161`（`POST /update/` 删除路径的密码来源优先级；注意不是 `:233` 的 `DELETE /{key}`）
- Test: `npm test`（`密码来源：/update/ 的写路径与删路径均以 body 优先` 用例由红转绿）

- [ ] 修改 `build-edge.cjs:161`：

```js
  "        const pwdErr = await verifyDeletePassword(key, params.password || request.headers.get('X-Password') || '');",
```

### Task 3.3：验证

- [ ] `npm test` → 全通过
- [ ] 额外确认「仅 header 传密码」在**被改动的这条路径**上仍可用（向后兼容，不能只保留 body）：

```js
test("删除（POST /update/ + 空 value）：仅用 X-Password 头仍可用（向后兼容）", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "hc", value: "v1", password: "pass1234" }));
  const r = await call(
    kv,
    "/update/",
    jsonInit({ key: "hc", value: "" }, { "X-Password": "pass1234" })
  );
  assert.equal(r.status, 200, "改为 body 优先后，仍应保留 header 回退");
});

test("删除（DELETE /{key}）：X-Password 头路径不受本 Phase 影响", async () => {
  const kv = makeKV();
  await call(kv, "/update/", jsonInit({ key: "hc2", value: "v1", password: "pass1234" }));
  const r = await call(kv, "/hc2", { method: "DELETE", headers: { "X-Password": "pass1234" } });
  assert.equal(r.status, 200);
});
```

- [ ] 提交：`git commit -m "fix(edge): 统一写/删路径密码来源为 body 优先"`

---

## Phase 4：localStorage 写入异常保护（P2-3）⏳ 待执行

### Task 4.1：定位并包裹

**Files:**
- Modify: `src/App.tsx:37-40`

- [ ] 确认现状（`src/App.tsx:37-40`，读取侧 `getInitialNav` 在 18-24 行**已有** try/catch，写入侧缺失）：

```tsx
// 记住最后打开的导航项
useEffect(() => {
  localStorage.setItem("textdb-active-nav", activeNav);
}, [activeNav]);
```

- [ ] 改为（与既有 `getInitialNav` 的降级风格一致）：

```tsx
// 记住最后打开的导航项
useEffect(() => {
  // 隐私模式 / 存储被禁用时 setItem 会抛错，静默降级（读取侧 getInitialNav 已有同样保护）
  try {
    localStorage.setItem("textdb-active-nav", activeNav);
  } catch {
    /* ignore */
  }
}, [activeNav]);
```

### Task 4.2：验证（无 DOM 测试环境，人工验证）

> 项目无 DOM 测试环境，不引入 jsdom（避免为一个 3 行改动增加依赖）。

- [ ] `npm run typecheck && npm run lint` 通过
- [ ] `npm run dev` 启动，浏览器打开 DevTools → Application → Storage 勾选「Block third-party cookies / 禁用存储」后切换导航，确认**无未捕获异常**且页面功能正常
- [ ] 提交：`git commit -m "fix(ui): 导航持久化写入 localStorage 加异常保护"`

---

## Phase 5：`sync-to-github` 的 `--force` 决策（P2-4）⏳ 待决策

### Task 5.1：现状确认（本次已核实，与 REVIEW_TODO 的描述有重要补充）

**Files:**
- Read: `.cnb.yml:158-164`（自动同步链路）、`.cnb.yml:278-327`（手动同步链路）
- Reference: `REVIEW_TODO.md` 第 4 项

`.cnb.yml` 中存在**两条** GitHub 同步链路，行为不同：

| 链路 | 位置 | 当前行为 |
|---|---|---|
| **自动同步**（push 触发） | `.cnb.yml:158-164`（`.sync-github` 锚点） | `git push github "${BRANCH}" --force` —— **无条件强推** |
| **手动同步**（web trigger） | `.cnb.yml:278-327` | 已支持 `FORCE_PUSH` 开关：`FORCE_PUSH=true` 才加 `--force`，并另有 `DRY_RUN` / `PUSH_BRANCH` / `PUSH_TAGS` |

即：**REVIEW_TODO 第 4 项建议的「仅在手动触发时按 FORCE_PUSH 变量控制」在手动链路中已经实现**，未实现的只是自动链路。

- [ ] 确认事实：**CNB 是唯一真源**，GitHub 仅作公开镜像（CNB 仓库为私有，外部无法向 GitHub 镜像提交）
- [ ] 确认影响面：自动链路的 `--force` 会覆盖 GitHub 上对应分支历史

### Task 5.2：决策（二选一，需人工拍板）

| 选项 | 做法 | 适用场景 |
|---|---|---|
| **A. 保持自动 `--force`（推荐）** | 不改代码，仅在 `REVIEW_TODO.md` 标注「已确认预期行为」 | CNB 为唯一真源、GitHub 为只读镜像——镜像与源强一致正是期望语义；且手动链路已具备 `FORCE_PUSH` 逃生阀 |
| **B. 移除自动 `--force`** | 自动链路也改为默认不快进则告警，仅 `FORCE_PUSH=true` 时强推 | 若将来开放 GitHub 侧 PR/提交（当前不可能） |

- [ ] 若选 A：更新 `REVIEW_TODO.md` 第 4 项为「已确认无需处理」，说明理由（含「手动链路已有 FORCE_PUSH 控制」这一事实）
- [ ] 若选 B：修改 `.cnb.yml:162` 为：

```yaml
      if [ "${FORCE_PUSH}" = "true" ]; then
        git push github "${BRANCH}" --force 2>&1 || echo "WARN: failed to push branch ${BRANCH}"
      else
        git push github "${BRANCH}" 2>&1 || echo "WARN: 非快进推送被拒绝（需要 FORCE_PUSH=true）"
      fi
```

- [ ] 无论选哪个，都用 `node /root/.codebuddy/skills/cnb-pipeline/validator/validate.js .cnb.yml` 校验，并确认告警数与改动前一致（存量 19 条均在 `$: vscode` 段）

---

## Phase 6：首页 AI 爬虫死代码处置（P3-6）⏳ 待决策

### Task 6.1：结论复核

**Files:**
- Reference: `REVIEW_TODO.md` 第 6 项（响应头证据）
- Read: `build-edge.cjs`（`isAiCrawler` / `AI_CRAWLERS` / `onRequest` 中 `path === '/'` 分支）

- [ ] 确认死代码事实（响应头证据已记录在 `REVIEW_TODO.md` 第 6 项）：`/` 与 `/index.html` 由平台静态托管返回，函数中该分支从不执行

### Task 6.2：三方案评估（本次已额外查证，结论有更新）

| 方案 | 可行性（已查证） | 能否达成原目标 | 风险 |
|---|---|---|---|
| ① 用 `edgeone.json` 的 `headers` 声明 | ✅ 语法存在（`{source, headers:[{key,value}]}`，CLI schema 确认支持） | ❌ **不能**——静态配置只能无条件加 `Vary: User-Agent`，无法做「爬虫 no-cache / 普通用户正常缓存」的条件分支，反而会引入当初担心的缓存碎片化 | 低 |
| ② 删除 `dist/index.html` 静态副本，改由函数唯一提供 | ✅ 可行 | ✅ 能完整实现 | **中高**——`routes.json` 的 SPA fallback 规则 `{src:"/.*", dest:"/index.html"}` 依赖该文件存在，深链（如 `/md/xxx` 之外的路径）可能退化 |
| ③ 移除死代码，放弃该意图 | ✅ | ➖ 放弃（影响有限） | 无 |

**推荐方案 ③**，依据：静态 `index.html` 已内嵌 JSON-LD，AI 爬虫仍能读到正确内容，原意图的实际收益很小；而 ① 无法达成目标、② 有破坏 SPA fallback 的风险。

### Task 6.3：实施（待选定后执行）

- [ ] 方案 ③：从 `build-edge.cjs` 的 `onRequest` 中删除 `if (path === '/' || path === '/index.html')` 分支（含 `isAiCrawler` 相关的 `Vary` / `Cache-Control` 设置），并同步移除 `AI_CRAWLERS` 常量与 `ai-crawler-agents.json` 的引入
  - ⚠️ 保留 `ai-crawler-agents.json` 文件本身（`REVIEW_TODO.md` 记录其数据源为 ai.robots.txt，未来可能复用）
- [ ] 方案 ②：从 vite 构建产物中排除 `index.html`（或部署后删除 `.edgeone/assets/index.html`），并在 preview 环境验证深链 fallback 未退化
- [ ] 方案 ①：在 `edgeone.json` 增加：

```json
{
  "headers": [
    {
      "source": "/",
      "headers": [{ "key": "Vary", "value": "User-Agent" }]
    }
  ]
}
```

- [ ] 验证：`npm run build && npm test` 通过；部署后 `curl -sI https://text.hunluan.space/ | grep -i vary` 确认预期生效
- [ ] 提交：`git commit -m "chore(edge): 处置首页 AI 爬虫死代码（方案 X）"`

---

## 最终验证（全部 Phase 完成后）⏳ 待执行

- [ ] `npm run lint` 通过
- [ ] `npm run typecheck` 通过
- [ ] `npm test` 全通过（预期 20+ 项）
- [ ] `npm run build` 且**连续两次构建哈希一致**（`src/index.css` 的 `@source not` 规则不可移除）
- [ ] 边缘函数体积仍在 19-25 KB（`.cnb.yml` 的体积断言通过）
- [ ] `.cnb.yml` 加测试阶段：

```yaml
  - name: npm-test
    script: |
      npm install
      npm test
```

- [ ] 部署后线上端到端复测（生产与预发两个域名）：`/stats`、`/test-kv`、写入/读取/删除、`/p/`、`/md/`、`/file/txt/`、`/file/html/`（拒绝）、非法 key（400）、密码全流程（设密/拒改/改/拒删/删）
- [ ] `REVIEW_TODO.md` 逐项标注处理结果；`CHANGELOG.md` 追加 Unreleased 条目

---

## 风险与回退

| 风险 | 触发条件 | 回退方案 |
|---|---|---|
| **PBKDF2 在 EdgeOne 运行时不支持或过慢** | Task 2.4 线上验证返回 500/超时 | 将 `PASSWORD_VERSION` 回退为 1 并让 `setPasswordMeta` 用 `sha256Hex`；`hashForVersion` 的版本分支保留，已升级的 v2 记录回退后无法校验 → **回退前需先确认没有 v2 记录**（`TEXTDB.list({prefix:'tdb_'})` 抽查 `.pwd` 结尾的键）。这是本计划唯一的兼容性硬缺口，**因此 Phase 2 必须在合并 master 前完成线上验证** |
| 迁移逻辑导致存量密码失效 | Phase 2 后用户报「密码错误」 | `checkPassword` 的 v1 分支保证旧记录可校验；若仍异常，用 `git revert` 回退该提交（KV 中元数据格式向后兼容，回退后 v2 记录会计为密码错误） |
| 恒定时间比较引入逻辑错误 | `npm test` 密码用例失败 | 回退 `constantTimeEqual` 调用为直接比较（1 行改动） |
| 测试基线本身写错（把错误行为固化） | 测试通过但线上表现不同 | Phase 0 完成后先用 `curl` 对**当前线上**跑一遍等价断言，交叉验证 |
| 死代码处置方案②破坏深链 | 方案②实施后 `/xxx` 深链 404 | 恢复 `dist/index.html` 静态副本（重新构建即可） |

## 完成定义（DoD）

- [ ] 6 项遗留全部有明确结论（已修复 / 已确认无需处理 / 待决策并记录理由）
- [ ] `npm test` 成为 push 前的固定关卡，并接入 `.cnb.yml`
- [ ] 线上（生产 + 预发）端到端测试全通过
- [ ] 构建哈希稳定、函数体积在阈值内
- [ ] 文档（`REVIEW_TODO.md`、`CHANGELOG.md`、`AGENTS.md`）与实际实现一致
