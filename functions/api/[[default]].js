
const STATIC_FILES = ${staticMapJSON};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function getMimeType(p) {
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8", ".js": "application/javascript", 
    ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon"
  };
  return types[ext] || "application/octet-stream";
}

async function handleApi(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const kv = (env && env.TEXTDB) || (typeof TEXTDB !== 'undefined' ? TEXTDB : null);

  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS});

  if (!kv) {
    return new Response(JSON.stringify({status: 0, error: "KV 'TEXTDB' not found"}), {status: 500, headers: {...CORS, "Content-Type": "application/json"}});
  }

  try {
    // 写入/更新
    if (request.method === "POST") {
      let key, value;
      const ct = (request.headers.get("content-type") || "").toLowerCase();
      
      if (path === "/update/" || path === "/update" || path === "/api/update") {
        let params = {};
        if (ct.includes("json")) params = await request.json();
        else {
          const fd = await request.formData();
          params = Object.fromEntries(fd.entries());
        }
        key = (params.key || "").trim();
        value = params.value;
      } else {
        key = path.split("/").pop();
        value = ct.includes("json") ? await request.json().then(v => typeof v === 'string' ? v : JSON.stringify(v)) : await request.text();
      }

      if (!key || !/^[0-9a-zA-Z_]{1,512}$/.test(key)) return new Response(JSON.stringify({status:0, error:"Invalid Key"}), {status:400, headers: {...CORS, "Content-Type":"application/json"}});

      if (!value) {
        await kv.delete(key);
        return new Response(JSON.stringify({status:1, data:{key, action:"deleted"}}), {headers: {...CORS, "Content-Type":"application/json"}});
      }

      await kv.put(key, value);
      return new Response(JSON.stringify({status:1, data:{key, url: url.origin + "/" + key}}), {headers: {...CORS, "Content-Type":"application/json"}});
    }

    // 读取
    if (request.method === "GET") {
      const key = path.split("/").pop();
      if (key && /^[0-9a-zA-Z_]{1,512}$/.test(key)) {
        const val = await kv.get(key);
        return new Response(val || "", {headers: {...CORS, "Content-Type": "text/plain; charset=utf-8"}});
      }
    }

    // 删除
    if (request.method === "DELETE") {
      const key = path.split("/").pop();
      await kv.delete(key);
      return new Response(JSON.stringify({status:1, data:{key, action:"deleted"}}), {headers: {...CORS, "Content-Type":"application/json"}});
    }

    return new Response(JSON.stringify({status:0, error:"Not Found"}), {status:404, headers: {...CORS, "Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({status:0, error: e.message}), {status:500, headers: {...CORS, "Content-Type":"application/json"}});
  }
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    return new Response(STATIC_FILES["/index.html"], {headers: {"Content-Type": "text/html; charset=utf-8", ...CORS}});
  }
  if (STATIC_FILES[path]) {
    return new Response(STATIC_FILES[path], {headers: {"Content-Type": getMimeType(path), ...CORS}});
  }

  return handleApi(context);
}
