// TextDB EdgeOne - 在线文本数据库
// Catch-all: edge-functions/[[default]].js

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function getParams(request) {
  const { searchParams } = new URL(request.url);
  const urlParams = Object.fromEntries(searchParams.entries());
  let bodyParams = {};
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    try {
      if (contentType.includes("application/json")) {
        bodyParams = await request.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        bodyParams = Object.fromEntries(formData.entries());
      }
    } catch (e) {}
  }
  return { ...urlParams, ...bodyParams };
}

function isValidKey(key) {
  return /^[0-9a-zA-Z\-_]{6,60}$/.test(key);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function generateId() {
  return Math.random().toString(36).slice(2, 18);
}

export default function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const kv = env.TEXTDB;

  try {
    if (!kv) {
      return jsonResponse({ status: 0, error: "KV 未绑定：请在 EdgeOne 控制台绑定 TEXTDB 命名空间", env_keys: Object.keys(env || {}) }, 500);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // POST /update/
    if (path === "/update/" || path === "/update") {
      if (request.method !== "POST") {
        return jsonResponse({ status: 0, error: "请使用 POST 方法" }, 405);
      }
      return getParams(request).then(async (params) => {
        const key = (params.key || "").trim();
        const value = params.value;
        if (!isValidKey(key)) {
          return jsonResponse({ status: 0, error: "key 格式错误：6-60 位，仅支持 0-9a-zA-Z-_-" }, 400);
        }
        if (value === "" || value === undefined || value === null) {
          await kv.delete(key);
          return jsonResponse({ status: 1, data: { key, url: `${url.origin}/${key}`, action: "deleted" }, req_id: generateId() });
        }
        if (typeof value !== "string" || value.length > 200000) {
          return jsonResponse({ status: 0, error: "value 不能为空且不能超过 20 万字符" }, 400);
        }
        await kv.put(key, value);
        return jsonResponse({ status: 1, data: { key, url: `${url.origin}/${key}` }, req_id: generateId() });
      });
    }

    // GET /{key}
    if (request.method === "GET") {
      const key = path.slice(1);
      if (!key) {
        return new Response(INDEX_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (!isValidKey(key)) {
        return new Response("", { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
      }
      return kv.get(key).then((value) => {
        return new Response(value || "", { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
      });
    }

    // POST /{key}
    if (request.method === "POST" && path !== "/" && path !== "/update/" && path !== "/update") {
      const key = path.slice(1);
      if (!isValidKey(key)) {
        return jsonResponse({ status: 0, error: "key 格式错误" }, 400);
      }
      const contentType = (request.headers.get("content-type") || "").toLowerCase();
      let valuePromise;
      if (contentType.includes("application/json")) {
        valuePromise = request.json().then((body) => typeof body === "string" ? body : JSON.stringify(body));
      } else {
        valuePromise = request.text();
      }
      return valuePromise.then(async (value) => {
        if (!value) {
          await kv.delete(key);
          return jsonResponse({ status: 1, data: { key, action: "deleted" }, req_id: generateId() });
        }
        if (value.length > 200000) {
          return jsonResponse({ status: 0, error: "value 不能超过 20 万字符" }, 400);
        }
        await kv.put(key, value);
        return jsonResponse({ status: 1, data: { key, url: `${url.origin}/${key}` }, req_id: generateId() });
      });
    }

    // DELETE /{key}
    if (request.method === "DELETE") {
      const key = path.slice(1);
      if (!isValidKey(key)) {
        return jsonResponse({ status: 0, error: "key 格式错误" }, 400);
      }
      return kv.delete(key).then(() => {
        return jsonResponse({ status: 1, data: { key, action: "deleted" }, req_id: generateId() });
      });
    }

    return jsonResponse({ status: 0, error: "不支持的请求方式" }, 405);

  } catch (err) {
    return jsonResponse({ status: 0, error: "服务器错误", detail: err.message }, 500);
  }
}

// 内嵌首页（Edge Function 无法直接 fetch 静态文件）
const INDEX_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>TextDB</title></head>
<body style="font-family:sans-serif;text-align:center;padding:2rem">
<h1>📦 TextDB EdgeOne</h1>
<p>服务运行中。使用 API 操作数据。</p>
<p><a href="/update/">API 文档</a></p>
</body></html>`;
