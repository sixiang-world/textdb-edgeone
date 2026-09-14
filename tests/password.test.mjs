import test from "node:test";
import assert from "node:assert/strict";
import { makeKV, call, jsonInit, readJSON } from "./helpers.mjs";

// 密码校验链路：覆盖 constantTimeEqual 的两个分支
// （长度不等 → 长度短路返回 false；长度相等 → 逐字节比较返回 false），
// 以及正确密码放行的正路径。Phase 2 在此文件追加哈希版本迁移相关用例。

const PWD_KEY = (key) => `tdb_${key}.pwd`;

/** 设密码并返回该 key 的 KV 实例 */
async function seedWithPassword(key, password) {
  const kv = makeKV();
  const r = await call(kv, "/update/", jsonInit({ key, value: "v1", password }));
  assert.equal(r.status, 200, "初次设密码写入应成功");
  return kv;
}

/** 读回并解析某 key 的密码元数据 */
function readMeta(kv, key) {
  const raw = kv.store.get(PWD_KEY(key));
  return raw ? JSON.parse(raw) : null;
}

/**
 * 复现 v1（旧）哈希算法：SHA-256(saltBytes || passwordBytes) 的 hex。
 * 用于预置存量记录，验证向后兼容与透明迁移。
 */
async function legacyV1Meta(password) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = btoa(String.fromCharCode(...saltBytes));
  const pwdBytes = new TextEncoder().encode(password);
  const combined = new Uint8Array(saltBytes.length + pwdBytes.length);
  combined.set(saltBytes);
  combined.set(pwdBytes, saltBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const h = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { h, s: salt, v: 1 };
}

test("密码校验：正确密码放行", async () => {
  const kv = await seedWithPassword("p", "pass1234");
  const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: "pass1234" }));
  assert.equal(r.status, 200, "正确密码应通过");
  assert.equal((await readJSON(r)).status, 1);
});

test("密码校验：同长度错误密码被拒（走逐字节比较分支）", async () => {
  const kv = await seedWithPassword("p", "pass1234");
  // "pass1235" 与正确密码等长（8 字符），只差最后一字节
  const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: "pass1235" }));
  assert.equal(r.status, 400, "同长度错误密码应被拒");
  assert.match(String((await readJSON(r)).error || ""), /password/i);
});

test("密码校验：不同长度错误密码被拒（走长度短路分支）", async () => {
  const kv = await seedWithPassword("p", "pass1234");
  // 注意区分："" 不会进入 constantTimeEqual，而是在 checkPassword 的 `if (!password) return false`
  // 与 verifyDeletePassword 的 `if (!inputPwd)` 处提前返回；只有非空且长度不同的才走长度短路分支。
  for (const wrong of ["pass", "pass12345678"]) {
    const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: wrong }));
    assert.equal(r.status, 400, `错误密码 "${wrong}" 应被拒（长度不同）`);
  }
});

test("密码校验：空密码不得绕过保护（在进入哈希比较前即被拒）", async () => {
  const kv = await seedWithPassword("p", "pass1234");
  const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: "" }));
  assert.equal(r.status, 400, "空密码应被拒（不得因空值绕过）");
  assert.notEqual((await readJSON(r)).status, 1, "不得返回成功");
});

test("密码校验：未提供密码时受保护的 key 不可改", async () => {
  const kv = await seedWithPassword("p", "pass1234");
  const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2" }));
  assert.equal(r.status, 400, "受保护 key 无密码不应可改");
});

// 注意：删除有两条不同入口，密码来源不同（2026-09-15 核实）
//   a) POST /update/ + value 空串 —— 前端实际使用；密码 body 优先、header 回退
//   b) DELETE /{key}            —— 规范（public/openapi.json）只声明 X-Password 头、无 requestBody，
//                                  故实现也只读 header（第 233 行），body 中的密码会被忽略

test("密码校验：DELETE /{key} 的密码来自 X-Password 头（符合 OpenAPI 规范）", async () => {
  const kv = await seedWithPassword("d", "pass1234");
  const hdr = (v) => ({ method: "DELETE", headers: { "X-Password": v } });

  assert.equal((await call(kv, "/d", hdr("pass1235"))).status, 400, "同长度错误密码应被拒");
  assert.equal((await call(kv, "/d", hdr("x"))).status, 400, "不同长度错误密码应被拒");
  assert.equal((await call(kv, "/d", hdr(""))).status, 400, "空密码应被拒");
  assert.equal((await call(kv, "/d", { method: "DELETE" })).status, 400, "未提供密码应被拒");
  assert.ok(kv.store.has("tdb_d"), "校验失败期间 key 不应被删除");

  assert.equal((await call(kv, "/d", hdr("pass1234"))).status, 200, "正确密码应删除成功");
  assert.ok(!kv.store.has("tdb_d"), "应已从 KV 删除");
});

test("密码校验：DELETE /{key} 忽略 body 中的密码（规范仅声明 X-Password 头）", async () => {
  const kv = await seedWithPassword("d2", "pass1234");
  const r = await call(kv, "/d2", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "pass1234" }),
  });
  assert.equal(r.status, 400, "正确密码放在 body 中也应被拒——DELETE 只认 X-Password 头");
  assert.ok(kv.store.has("tdb_d2"), "key 不应被删除");
});

test("密码校验：前端删除路径（POST /update/ + 空 value）可用 body 传密码", async () => {
  const kv = await seedWithPassword("d3", "pass1234");
  const r = await call(kv, "/update/", jsonInit({ key: "d3", value: "", password: "pass1234" }));
  assert.equal(r.status, 200, "body 传密码的删除应成功（src/api.ts 的 deleteData 即此路径）");
  assert.equal((await readJSON(r)).data.action, "deleted");
  assert.ok(!kv.store.has("tdb_d3"), "应已从 KV 删除");
});

// ===== Phase 2：PBKDF2 哈希 + v1 → v2 透明迁移 =====

test("PBKDF2：新设密码写入 v2 元数据（含迭代次数）", async () => {
  const kv = await seedWithPassword("m1", "pass1234");
  const meta = readMeta(kv, "m1");
  assert.equal(meta.v, 2, "新密码应为 v2 格式");
  assert.equal(meta.i, 100000, "应记录迭代次数，便于后续提升强度");
  assert.ok(meta.s, "应有盐");
  assert.equal(typeof meta.h, "string");
  assert.equal(meta.h.length, 64, "PBKDF2-SHA256 输出 32 字节 → 64 字符 hex");
});

test("PBKDF2：v2 记录 —— 正确密码通过、错误密码被拒", async () => {
  const kv = await seedWithPassword("m2", "pass1234");
  assert.equal(readMeta(kv, "m2").v, 2);

  const ok = await call(kv, "/update/", jsonInit({ key: "m2", value: "v2", password: "pass1234" }));
  assert.equal(ok.status, 200, "正确密码应通过");

  const bad = await call(kv, "/update/", jsonInit({ key: "m2", value: "v3", password: "pass1235" }));
  assert.equal(bad.status, 400, "错误密码应被拒");
});

test("向后兼容：存量 v1 记录的正确密码仍可校验", async () => {
  const meta = await legacyV1Meta("legacy123");
  const kv = makeKV({ tdb_old: "legacy-value", [PWD_KEY("old")]: JSON.stringify(meta) });

  const r = await call(kv, "/update/", jsonInit({ key: "old", value: "updated", password: "legacy123" }));
  assert.equal(r.status, 200, "旧算法的密码必须仍能通过校验（否则存量用户全部失联）");
});

test("透明迁移：v1 记录在密码校验通过后升级为 v2", async () => {
  const meta = await legacyV1Meta("legacy123");
  const kv = makeKV({ tdb_old2: "v", [PWD_KEY("old2")]: JSON.stringify(meta) });
  assert.equal(readMeta(kv, "old2").v, 1, "迁移前应为 v1");

  await call(kv, "/update/", jsonInit({ key: "old2", value: "new", password: "legacy123" }));

  const after = readMeta(kv, "old2");
  assert.equal(after.v, 2, "校验通过后应升级为 v2");
  assert.equal(after.i, 100000);
  assert.ok(after.u, "应记录升级时间戳");
  assert.equal(after.s, meta.s, "应复用原盐，避免迁移期出现新旧不一致");
  assert.notEqual(after.h, meta.h, "哈希算法变了，哈希值必然不同");
});

test("透明迁移：升级后的 v2 记录可用同一密码继续校验", async () => {
  const meta = await legacyV1Meta("legacy123");
  const kv = makeKV({ tdb_old4: "v", [PWD_KEY("old4")]: JSON.stringify(meta) });
  await call(kv, "/update/", jsonInit({ key: "old4", value: "a", password: "legacy123" }));
  assert.equal(readMeta(kv, "old4").v, 2, "前置条件：已升级");
  // 升级后必须仍认得同一个密码（若迁移逻辑把哈希算错，这里会暴露）
  const again = await call(kv, "/update/", jsonInit({ key: "old4", value: "b", password: "legacy123" }));
  assert.equal(again.status, 200, "升级后同一密码应继续可用");
});

test("安全：v1 记录的错误密码不得触发升级（防污染元数据）", async () => {
  const meta = await legacyV1Meta("legacy123");
  const original = JSON.stringify(meta);
  const kv = makeKV({ tdb_old3: "v", [PWD_KEY("old3")]: original });

  const r = await call(kv, "/update/", jsonInit({ key: "old3", value: "x", password: "WRONG" }));
  assert.equal(r.status, 400, "错误密码应被拒");
  assert.equal(kv.store.get(PWD_KEY("old3")), original, "元数据必须原样保留，不得被改写");
});

test("安全：v2 记录的哈希不得被降级回 v1", async () => {
  const kv = await seedWithPassword("m3", "pass1234");
  await call(kv, "/update/", jsonInit({ key: "m3", value: "v2", password: "pass1234" }));
  assert.equal(readMeta(kv, "m3").v, 2, "已是 v2 的记录不应被改回 v1");
});

test("改密码：v1 存量记录改密后元数据为 v2 且新密码生效", async () => {
  const meta = await legacyV1Meta("legacy123");
  const kv = makeKV({ tdb_c1: "v", [PWD_KEY("c1")]: JSON.stringify(meta) });

  const r = await call(
    kv,
    "/update/",
    jsonInit({ key: "c1", value: "v2", password: "legacy123", new_password: "brandnew99" })
  );
  assert.equal(r.status, 200, "用旧密码改密应成功");
  assert.equal(readMeta(kv, "c1").v, 2, "改密应写入 v2 元数据");

  const oldTry = await call(kv, "/update/", jsonInit({ key: "c1", value: "v3", password: "legacy123" }));
  assert.equal(oldTry.status, 400, "旧密码应失效");
  const newTry = await call(kv, "/update/", jsonInit({ key: "c1", value: "v3", password: "brandnew99" }));
  assert.equal(newTry.status, 200, "新密码应生效");
});

test("删除：v1 存量记录可用正确密码删除", async () => {
  const meta = await legacyV1Meta("legacy123");
  const kv = makeKV({ tdb_od: "v", [PWD_KEY("od")]: JSON.stringify(meta) });

  const wrong = await call(kv, "/od", { method: "DELETE", headers: { "X-Password": "nope" } });
  assert.equal(wrong.status, 400, "错误密码删除应被拒");
  assert.ok(kv.store.has("tdb_od"), "校验失败期间不应删除");

  const ok = await call(kv, "/od", { method: "DELETE", headers: { "X-Password": "legacy123" } });
  assert.equal(ok.status, 200, "v1 存量记录的正确密码应能删除");
  assert.ok(!kv.store.has("tdb_od"), "应已删除");
  assert.ok(!kv.store.has(PWD_KEY("od")), "密码元数据应一并清除");
});

test("移除密码保护：改密时 new_password 为空串可移除", async () => {
  const kv = await seedWithPassword("rm1", "pass1234");
  const r = await call(
    kv,
    "/update/",
    jsonInit({ key: "rm1", value: "v2", password: "pass1234", new_password: "" })
  );
  assert.equal(r.status, 200, "空 new_password 应移除保护");
  assert.equal(readMeta(kv, "rm1"), null, "密码元数据应被删除");

  const free = await call(kv, "/update/", jsonInit({ key: "rm1", value: "v3" }));
  assert.equal(free.status, 200, "移除保护后应可免密更新");
});

