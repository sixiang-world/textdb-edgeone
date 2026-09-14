import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FN_PATH = resolve(ROOT, "edge-functions/[[default]].js");

/** 内存 KV，接口与 EdgeOne KV 一致（get/put/delete/list） */
export function makeKV(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    _store: store,
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
