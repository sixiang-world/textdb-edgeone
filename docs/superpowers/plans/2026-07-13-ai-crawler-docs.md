# AI Crawler 友好化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 爬虫访问 `https://text.hunluan.space/` 时能获取到结构化的网站使用说明。

**Architecture:** 在 `build-edge.cjs`（构建时生成 edge function 的脚本）中添加 AI 爬虫检测逻辑。当根路径 `/` 收到请求时，检测 User-Agent，匹配爬虫则在 HTML `<head>` 中注入 JSON-LD 结构化数据。AI 文档内容已存储在 KV `docs` key 中，通过 `/{key}` 路由以 `text/plain` 返回。

**Tech Stack:** Node.js (build-edge.cjs) + EdgeOne Edge Function (V8 runtime)

**前置条件：** KV `docs` key 已完成 Markdown 文档写入（密码 `311113qaz` 保护），可直接通过 `https://text.hunluan.space/docs` 访问。

---

## File Structure

```
textdb-edgeone/
├── build-edge.cjs                    # 修改 — 添加 AI 爬虫检测 + JSON-LD 注入
├── docs/superpowers/specs/
│   └── 2026-07-13-ai-crawler-docs.md # 设计规格文档
```

**注意：** `build-edge.cjs` 在 `npm run build` 时会生成 `functions/[[default]].js`、`functions/api/[[default]].js`、`edge-functions/[[default]].js` 三个文件。修改 `build-edge.cjs` 后重新构建即可生效。

---

### Task 1: 在 build-edge.cjs 中添加 AI 爬虫检测 + JSON-LD 注入

**Files:**
- Modify: `build-edge.cjs` (line 331-333 附近，根路径返回逻辑)

- [ ] **Step 1: 在 build-edge.cjs 的 `lines` 数组中，在 `const AI_CRAWLERS` 常量定义前添加爬虫列表和检测函数**

在 `const CORS = {` 定义之后（约 line 36 之后），添加：

```javascript
// AI 爬虫 User-Agent 检测
const AI_CRAWLERS = [
  'Claude-Web', 'GPTBot', 'ChatGPT-User', 'CCBot',
  'PerplexityBot', 'Anthropic-AI', 'Amazonbot',
  'Bytespider', 'Applebot-Extended', 'FacebookBot',
  'cohere-ai', 'Diffbot', 'DataForSeoBot', 'omgili',
  'Google-Extended',
];

function isAiCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return AI_CRAWLERS.some(name => ua.includes(name.toLowerCase()));
}
```

- [ ] **Step 2: 添加 JSON-LD 内容常量**

在 `isAiCrawler` 函数之后添加：

```javascript
const AI_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "TextDB EdgeOne",
  "description": "基于 EdgeOne Pages + KV 的在线文本数据库。支持写入、读取、删除文本数据，HTML/JS 渲染，文件夹上传，密码保护等功能。无需注册登录，匿名即可使用。",
  "url": "https://text.hunluan.space/",
  "mainEntityOfPage": "https://text.hunluan.space/docs",
  "applicationCategory": "Database",
  "operatingSystem": "Web",
  "browserRequirements": "Requires JavaScript",
  "featureList": [
    "写入/读取/删除文本 Key-Value",
    "HTML 渲染 (/p/{key})",
    "JavaScript 输出 (/file/js/{key})",
    "Markdown 渲染 (/md/{key}, /file/md/{key})",
    "文件夹批量上传 (webkitdirectory)",
    "密码保护 (设置/修改/移除)",
    "二维码生成与下载",
    "RESTful API"
  ]
});
```

- [ ] **Step 3: 修改根路径 `/` 的返回逻辑**

找到 `build-edge.cjs` 中约 line 331-333 的代码：

```javascript
  if (path === '/' || path === '/index.html') {
    return new Response(STATIC_FILES['/index.html'], {headers: {'Content-Type': 'text/html; charset=utf-8', ...CORS}});
  }
```

替换为：

```javascript
  if (path === '/' || path === '/index.html') {
    const requestUA = request.headers.get('User-Agent') || '';
    let html = STATIC_FILES['/index.html'];
    if (isAiCrawler(requestUA)) {
      const script = `<script type="application/ld+json">${AI_JSON_LD}</script>`;
      html = html.replace('</head>', script + '\n</head>');
    }
    return new Response(html, {headers: {'Content-Type': 'text/html; charset=utf-8', ...CORS}});
  }
```

- [ ] **Step 4: 验证构建**

Run: `npm run build`

Expected: 构建成功。生成的三个 edge function 文件中包含新的爬虫检测逻辑。

快速验证 AI 爬虫检测是否正确注入：

```bash
# 普通浏览器 UA → 不包含 JSON-LD
curl -s -H "User-Agent: Mozilla/5.0 Windows" https://text.hunluan.space/ | grep -c "application/ld+json"
Expected: 0

# AI 爬虫 UA → 包含 JSON-LD
curl -s -H "User-Agent: Claude-Web" https://text.hunluan.space/ | grep -c "application/ld+json"
Expected: 1

# AI 爬虫 UA → JSON-LD 内容完整
curl -s -H "User-Agent: GPTBot" https://text.hunluan.space/ | grep "featureList"
Expected: 包含 featureList 数组
```

- [ ] **Step 5: Commit**

```bash
git add build-edge.cjs
git commit -m "feat: AI crawler detection with JSON-LD injection on root path"
```

---

### Task 2: 部署验证

- [ ] **Step 1: 确保 `docs` key 内容存在**

```bash
curl -s https://text.hunluan.space/docs | head -3
Expected: 输出 "TextDB EdgeOne 使用指南" 标题

# 密码保护的验证
curl -s -X POST https://text.hunluan.space/update/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "key=docs&value=new" | grep "Password required"
Expected: 需要密码，返回错误
```

- [ ] **Step 2: 推送部署到 EdgeOne**

```bash
git push origin dev
```

等待部署完成后（或手动触发 CI/CD），用以下命令验证线上环境：

```bash
# 线上根路径 — 普通 UA
curl -s -H "User-Agent: Mozilla/5.0" https://text.hunluan.space/ | grep "json"

# 线上根路径 — AI 爬虫
curl -s -H "User-Agent: Claude-Web" https://text.hunluan.space/ | grep "application/ld+json"

# 线上根路径 — 另一个 AI 爬虫
curl -s -H "User-Agent: GPTBot" https://text.hunluan.space/ | grep "featureList"

# 线上 /docs — 确认内容不受影响
curl -s https://text.hunluan.space/docs | head -3
```

Expected: 普通 UA 无 JSON-LD，AI 爬虫有 JSON-LD 且内容完整。

---

### Future: GitHub Actions UA 列表自动维护

（不在本次实施范围内，留作后续优化）

- 创建 `.github/workflows/update-crawler-agents.yml`
- 定时拉取三个数据源，合并去重生成 `ai-crawler-agents.json`
- PR 提交到仓库
- 修改 `build-edge.cjs` 读取该 JSON 文件替代硬编码列表
