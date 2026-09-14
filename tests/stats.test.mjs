import test from "node:test";
import assert from "node:assert/strict";
import { makeKV, call, readJSON } from "./helpers.mjs";

// /stats 是唯一依赖 KV list() 分页的功能：它用 limit=256 循环翻页累加 key 数，
// 并有 MAX_SCAN_KEYS=5000 的扫描上限（超过则 scannedAll=false）。
// 这些用例锁死该逻辑，防止分页 off-by-one / cursor 不前进 / 上限失效等回归。

/** 生成 n 个 tdb_ 前缀的 key */
function seedKeys(n) {
  const seed = {};
  for (let i = 0; i < n; i++) seed["tdb_k" + String(i).padStart(5, "0")] = "v";
  return seed;
}

test("/stats：恰好一页（256 个 key）", async () => {
  const kv = makeKV(seedKeys(256));
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.status, 1);
  assert.equal(j.data.totalKeys, 256);
  assert.equal(j.data.scannedAll, true, "一页内应扫描完整");
});

test("/stats：跨页累加（257 个 key）", async () => {
  const kv = makeKV(seedKeys(257));
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.data.totalKeys, 257, "应跨页累加，而非只算第一页");
  assert.equal(j.data.scannedAll, true);
});

test("/stats：多页累加（1000 个 key，约 4 页）", async () => {
  const kv = makeKV(seedKeys(1000));
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.data.totalKeys, 1000);
  assert.equal(j.data.scannedAll, true);
});

test("/stats：扫描上限边界 —— 上限内 scannedAll 为 true", async () => {
  const kv = makeKV(seedKeys(4999));
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.data.totalKeys, 4999);
  assert.equal(j.data.scannedAll, true, "未达上限应标记为扫描完整");
});

test("/stats：达到扫描上限（5000）时 scannedAll 为 false", async () => {
  const kv = makeKV(seedKeys(5100));
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.data.scannedAll, false, "超过 MAX_SCAN_KEYS 应标记为未扫描完整");
  assert.ok(j.data.totalKeys >= 5000, "应至少累加到上限值");
});

test("/stats：内部 key 不计入 totalKeys（仅统计 tdb_ 前缀）", async () => {
  const kv = makeKV({
    ...seedKeys(3),
    __stats_size__: "12345",
    ["__writes__" + new Date().toISOString().slice(0, 10)]: "7",
  });
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.data.totalKeys, 3, "内部计数器/体积 key 不应计入");
  assert.equal(j.data.totalSize, 12345, "totalSize 应读自 __stats_size__");
  assert.equal(j.data.writesToday, 7, "writesToday 应读自当日计数器");
});

test("/stats：KV 故障不致命（list 抛错时返回 status:1 且带 diag）", async () => {
  const kv = makeKV(seedKeys(2));
  kv.list = async () => {
    throw new Error("boom");
  };
  const j = await readJSON(await call(kv, "/stats"));
  assert.equal(j.status, 1, "单个统计维度失败不应导致整体 500");
  assert.match(String(j.diag || ""), /list:boom/);
});
