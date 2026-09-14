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
