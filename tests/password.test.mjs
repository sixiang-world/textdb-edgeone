import test from "node:test";
import assert from "node:assert/strict";
import { makeKV, call, jsonInit, readJSON } from "./helpers.mjs";

// 密码校验链路：覆盖 constantTimeEqual 的两个分支
// （长度不等 → 长度短路返回 false；长度相等 → 逐字节比较返回 false），
// 以及正确密码放行的正路径。Phase 2 会在此文件追加哈希版本迁移相关用例。

/** 设密码并返回该 key 的 KV 实例 */
async function seedWithPassword(key, password) {
  const kv = makeKV();
  const r = await call(kv, "/update/", jsonInit({ key, value: "v1", password }));
  assert.equal(r.status, 200, "初次设密码写入应成功");
  return kv;
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
  for (const wrong of ["pass", "pass12345678", ""]) {
    const r = await call(kv, "/update/", jsonInit({ key: "p", value: "v2", password: wrong }));
    assert.equal(r.status, 400, `错误密码 "${wrong}" 应被拒（不得因空值绕过）`);
  }
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
