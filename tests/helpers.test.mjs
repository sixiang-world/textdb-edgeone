import test from "node:test";
import assert from "node:assert/strict";
import { makeKV } from "./helpers.mjs";

// 直接验证 KV mock 自身（它是所有 API 测试的"预言机"，若它实现有误，
// 依赖它的测试会出现假绿）。分页语义尤其重要：/stats 依赖 list() 的
// complete / cursor 正确性来做多页累加。

test("KV mock：get 未命中返回 null（而非 undefined）", async () => {
  const kv = makeKV();
  assert.equal(await kv.get("missing"), null);
});

test("KV mock：put / get / delete 往返", async () => {
  const kv = makeKV();
  await kv.put("a", "1");
  assert.equal(await kv.get("a"), "1");
  await kv.delete("a");
  assert.equal(await kv.get("a"), null);
});

test("KV mock：list 按 prefix 过滤", async () => {
  const kv = makeKV({ tdb_a: "1", tdb_b: "2", other_c: "3" });
  const r = await kv.list({ prefix: "tdb_" });
  assert.deepEqual(
    r.keys.map((k) => k.key),
    ["tdb_a", "tdb_b"]
  );
  assert.equal(r.complete, true);
});

test("KV mock：list 分页 —— 300 个 key / limit 256，恰好两页", async () => {
  const seed = {};
  for (let i = 0; i < 300; i++) seed["tdb_k" + String(i).padStart(4, "0")] = "v";
  const kv = makeKV(seed);

  const p1 = await kv.list({ prefix: "tdb_", limit: 256 });
  assert.equal(p1.keys.length, 256, "第一页应满 256");
  assert.equal(p1.complete, false, "还有剩余，complete 应为 false");
  assert.ok(p1.cursor, "未完成时应有 cursor");

  const p2 = await kv.list({ prefix: "tdb_", limit: 256, cursor: p1.cursor });
  assert.equal(p2.keys.length, 44, "第二页应剩 44");
  assert.equal(p2.complete, true, "最后一页 complete 应为 true");
  assert.equal(p2.cursor, undefined, "完成时不应有 cursor");

  // 两页不重不漏
  const seen = new Set([...p1.keys, ...p2.keys].map((k) => k.key));
  assert.equal(seen.size, 300);
});

test("KV mock：list 边界 —— 恰好一页时 cursor 为空", async () => {
  const seed = {};
  for (let i = 0; i < 256; i++) seed["tdb_k" + String(i).padStart(4, "0")] = "v";
  const kv = makeKV(seed);
  const r = await kv.list({ prefix: "tdb_", limit: 256 });
  assert.equal(r.keys.length, 256);
  assert.equal(r.complete, true, "恰好一页应判定为 complete");
  assert.equal(r.cursor, undefined);
});
