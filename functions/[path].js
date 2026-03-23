// TextDB EdgeOne - 文本数据库
// 支持 GET/POST/DELETE，使用 EdgeOne KV 存储

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 从请求中提取参数（支持 GET query 和 POST body）
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

// 验证 key 格式：6-60 位，仅允许 0-9a-zA-Z-_
function isValidKey(key) {
  return /^[0-9a-zA-Z\-_]{6,60}$/.test(key);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const kv = env.TEXTDB;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // POST /update/ 或 /update - 创建/更新/删除
  if (path === "/update/" || path === "/update") {
    if (request.method !== "POST") {
      return jsonResponse({ status: 0, error: "请使用 POST 方法" }, 405);
    }

    const params = await getParams(request);
    const key = (params.key || "").trim();
    const value = params.value;

    if (!isValidKey(key)) {
      return jsonResponse({ status: 0, error: "key 格式错误：6-60 位，仅支持 0-9a-zA-Z-_-", data: null }, 400);
    }

    // value 为空字符串表示删除
    if (value === "" || value === undefined || value === null) {
      await kv.delete(key);
      return jsonResponse({
        status: 1,
        data: { key, url: `${url.origin}/${key}`, action: "deleted" },
        req_id: generateId(),
      });
    }

    if (typeof value !== "string" || value.length > 200000) {
      return jsonResponse({ status: 0, error: "value 不能为空且不能超过 20 万字符", data: null }, 400);
    }

    await kv.put(key, value);
    return jsonResponse({
      status: 1,
      data: { key, url: `${url.origin}/${key}` },
      req_id: generateId(),
    });
  }

  // GET /{key} - 读取
  if (request.method === "GET") {
    const key = path.slice(1);
    if (!key) {
      return fetch(new URL("./index.html", import.meta.url));
    }
    if (!isValidKey(key)) {
      return new Response("", { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
    }
    const value = await kv.get(key);
    if (value === null) {
      return new Response("", { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response(value, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // POST /{key} - 直接写入（简写方式）
  if (request.method === "POST" && path !== "/" && path !== "/update/" && path !== "/update") {
    const key = path.slice(1);
    if (!isValidKey(key)) {
      return jsonResponse({ status: 0, error: "key 格式错误", data: null }, 400);
    }

    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    let value;
    if (contentType.includes("application/json")) {
      const body = await request.json();
      value = typeof body === "string" ? body : JSON.stringify(body);
    } else {
      value = await request.text();
    }

    if (!value) {
      await kv.delete(key);
      return jsonResponse({ status: 1, data: { key, action: "deleted" }, req_id: generateId() });
    }

    if (value.length > 200000) {
      return jsonResponse({ status: 0, error: "value 不能超过 20 万字符", data: null }, 400);
    }

    await kv.put(key, value);
    return jsonResponse({ status: 1, data: { key, url: `${url.origin}/${key}` }, req_id: generateId() });
  }

  // DELETE /{key} - 删除
  if (request.method === "DELETE") {
    const key = path.slice(1);
    if (!isValidKey(key)) {
      return jsonResponse({ status: 0, error: "key 格式错误", data: null }, 400);
    }
    await kv.delete(key);
    return jsonResponse({ status: 1, data: { key, action: "deleted" }, req_id: generateId() });
  }

  return jsonResponse({ status: 0, error: "不支持的请求方式" }, 405);
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
