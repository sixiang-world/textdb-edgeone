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
  return /^[0-9a-zA-Z_]{1,512}$/.test(key);
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
  const kv = TEXTDB;

  try {
    if (!kv) {
      return jsonResponse({ status: 0, error: "KV 未绑定：请在 EdgeOne 控制台绑定 TEXTDB 命名空间" }, 500);
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
          return jsonResponse({ status: 0, error: "key 格式错误：仅支持数字、字母、下划线，最长 512 字符" }, 400);
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

// 内嵌首页（shadcn/ui 风格，Tailwind CSS CDN）
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TextDB EdgeOne</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>">
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');body{font-family:'Inter',system-ui,sans-serif}</style>
</head>
<body class="bg-zinc-950 text-zinc-50 min-h-screen">

<!-- Header -->
<header class="border-b border-zinc-800">
  <div class="max-w-3xl mx-auto px-4 py-6">
    <h1 class="text-2xl font-bold tracking-tight">📦 TextDB EdgeOne</h1>
    <p class="text-sm text-zinc-400 mt-1">基于 EdgeOne Pages + KV 的在线文本数据库</p>
  </div>
</header>

<main class="max-w-3xl mx-auto px-4 py-8 space-y-6">

  <!-- 写入卡片 -->
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
    <div class="px-6 py-4 border-b border-zinc-800">
      <h2 class="text-sm font-medium">写入 / 更新</h2>
    </div>
    <div class="px-6 py-4 space-y-4">
      <div>
        <label class="text-sm text-zinc-400 mb-1.5 block">Key</label>
        <div class="flex gap-2">
          <input id="wKey" type="text" placeholder="my_data_key"
            class="flex-1 h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition">
          <button onclick="genKey()" class="h-9 px-3 rounded-md border border-zinc-800 bg-zinc-950 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition">🎲 随机</button>
        </div>
      </div>
      <div>
        <label class="text-sm text-zinc-400 mb-1.5 block">Value</label>
        <textarea id="wValue" rows="5" placeholder="在此输入文本内容..."
          class="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition resize-y font-mono"></textarea>
      </div>
      <div class="flex gap-2">
        <button onclick="doWrite()" class="h-9 px-4 rounded-md bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-200 transition">写入</button>
        <button onclick="doDelete()" class="h-9 px-4 rounded-md border border-zinc-800 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition">删除此 Key</button>
      </div>
      <div id="wResult" class="hidden rounded-md border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 break-all max-h-48 overflow-auto"></div>
    </div>
  </div>

  <!-- 读取卡片 -->
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
    <div class="px-6 py-4 border-b border-zinc-800">
      <h2 class="text-sm font-medium">读取</h2>
    </div>
    <div class="px-6 py-4 space-y-4">
      <div class="flex gap-2">
        <input id="rKey" type="text" placeholder="输入 Key 读取数据"
          class="flex-1 h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition">
        <button onclick="doRead()" class="h-9 px-4 rounded-md bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-200 transition">读取</button>
      </div>
      <div id="rResult" class="hidden rounded-md border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 break-all max-h-48 overflow-auto"></div>
    </div>
  </div>

  <!-- API 文档 -->
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
    <div class="px-6 py-4 border-b border-zinc-800">
      <h2 class="text-sm font-medium">API 接口</h2>
    </div>
    <div class="px-6 py-4 space-y-3">
      <div class="flex items-center gap-3 text-sm">
        <span class="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">POST</span>
        <code class="text-zinc-300">/update/</code>
        <span class="text-zinc-500">写入 / 更新 / 删除</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span class="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">GET</span>
        <code class="text-zinc-300">/{key}</code>
        <span class="text-zinc-500">读取数据</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span class="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">POST</span>
        <code class="text-zinc-300">/{key}</code>
        <span class="text-zinc-500">直接写入（简写）</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span class="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/20">DELETE</span>
        <code class="text-zinc-300">/{key}</code>
        <span class="text-zinc-500">删除数据</span>
      </div>
    </div>
  </div>

  <!-- 请求示例 -->
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/50">
    <div class="px-6 py-4 border-b border-zinc-800">
      <h2 class="text-sm font-medium">请求示例</h2>
    </div>
    <div class="px-6 py-4 space-y-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-zinc-500 font-medium uppercase">cURL</span>
          <button onclick="copyCode('curl')" class="text-xs text-zinc-500 hover:text-zinc-300 transition">复制</button>
        </div>
        <pre id="curlCode" class="rounded-md bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-300 overflow-x-auto font-mono"></pre>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-zinc-500 font-medium uppercase">Python</span>
          <button onclick="copyCode('py')" class="text-xs text-zinc-500 hover:text-zinc-300 transition">复制</button>
        </div>
        <pre id="pyCode" class="rounded-md bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-300 overflow-x-auto font-mono"></pre>
      </div>
    </div>
  </div>

</main>

<!-- Footer -->
<footer class="border-t border-zinc-800 mt-12">
  <div class="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-zinc-600">
    TextDB EdgeOne · <a href="https://github.com/sixiang-world/textdb-edgeone" class="text-zinc-500 hover:text-zinc-300 transition" target="_blank">GitHub</a>
  </div>
</footer>

<!-- Toast -->
<div id="toast" class="fixed bottom-4 right-4 hidden rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm shadow-lg"></div>

<script>
const B = location.origin;
document.getElementById('curlCode').textContent = '# 写入\ncurl -X POST "' + B + '/update/" \\\n  -d "key=mykey&value=hello world"\n\n# 读取\ncurl "' + B + '/mykey"\n\n# 删除\ncurl -X DELETE "' + B + '/mykey"';
document.getElementById('pyCode').textContent = 'import requests\n\n# 写入\nrequests.post("' + B + '/update/",\n  data={"key": "mykey", "value": "hello world"})\n\n# 读取\nprint(requests.get("' + B + '/mykey").text)\n\n# 删除\nrequests.delete("' + B + '/mykey")';

function genKey() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let k = 'k_';
  for (let i = 0; i < 16; i++) k += c[Math.floor(Math.random() * c.length)];
  document.getElementById('wKey').value = k;
}

async function doWrite() {
  const key = document.getElementById('wKey').value.trim();
  const val = document.getElementById('wValue').value;
  const el = document.getElementById('wResult');
  if (!key) return show(el, '请输入 Key', false);
  if (!val) return show(el, '请输入 Value', false);
  try {
    const res = await fetch(B + '/update/', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'key=' + encodeURIComponent(key) + '&value=' + encodeURIComponent(val)
    });
    const d = await res.json();
    show(el, JSON.stringify(d, null, 2), d.status === 1);
    if (d.status === 1) toast('✅ 写入成功');
  } catch (e) { show(el, '请求失败: ' + e.message, false); }
}

async function doDelete() {
  const key = document.getElementById('wKey').value.trim();
  const el = document.getElementById('wResult');
  if (!key) return show(el, '请输入 Key', false);
  try {
    const res = await fetch(B + '/update/', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'key=' + encodeURIComponent(key) + '&value='
    });
    const d = await res.json();
    show(el, JSON.stringify(d, null, 2), d.status === 1);
    if (d.status === 1) toast('🗑️ 已删除');
  } catch (e) { show(el, '请求失败: ' + e.message, false); }
}

async function doRead() {
  const key = document.getElementById('rKey').value.trim();
  const el = document.getElementById('rResult');
  if (!key) return show(el, '请输入 Key', false);
  try {
    const res = await fetch(B + '/' + key);
    const t = await res.text();
    show(el, t || '（Key 不存在）', !!t);
  } catch (e) { show(el, '请求失败: ' + e.message, false); }
}

function show(el, text, ok) {
  el.textContent = text;
  el.classList.remove('hidden');
  el.className = el.className.replace(/border-(emerald|red)-500\/30/g, '');
  el.classList.add(ok ? 'border-emerald-500/30' : 'border-red-500/30');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2000);
}

function copyCode(lang) {
  const el = document.getElementById(lang + 'Code');
  navigator.clipboard.writeText(el.textContent).then(() => toast('已复制'));
}
</script>

</body></html>`;
