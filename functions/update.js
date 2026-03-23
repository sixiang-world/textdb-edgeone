const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};

export default async function onRequest(context) {
  const {request} = context;
  const url = new URL(request.url);
  
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:CORS});
  if (request.method !== "POST") {
    return new Response(JSON.stringify({status:0,error:"请使用 POST 方法"}), {status:405, headers:{...CORS,"Content-Type":"application/json"}});
  }
  
  const contentType = (request.headers.get("content-type")||"").toLowerCase();
  let params = {};
  try {
    if (contentType.includes("json")) params = await request.json();
    else if (contentType.includes("form")) { const fd = await request.formData(); params = Object.fromEntries(fd.entries()); }
  } catch(e) {}
  
  const key = (params.key||"").trim();
  const value = params.value;
  
  if (!/^[0-9a-zA-Z_]{1,512}$/.test(key)) {
    return new Response(JSON.stringify({status:0,error:"key 格式错误"}), {status:400, headers:{...CORS,"Content-Type":"application/json"}});
  }
  
  const kv = TEXTDB;
  if (value === "" || value === undefined || value === null) {
    await kv.delete(key);
    return new Response(JSON.stringify({status:1,data:{key,action:"deleted"}}), {headers:{...CORS,"Content-Type":"application/json"}});
  }
  await kv.put(key, value);
  return new Response(JSON.stringify({status:1,data:{key,url:url.origin+"/"+key}}), {headers:{...CORS,"Content-Type":"application/json"}});
}
