# TextDB EdgeOne AI Crawler 友好化设计

> 让 AI 爬虫（Claude Web Search、ChatGPT Browse、Firecrawl、Tavily 等）在访问 `https://text.hunluan.space/` 时，能够获取到网站的使用说明和功能描述。

## Background

当前 TextDB EdgeOne 是一个 React SPA，所有内容由 JS 在浏览器中渲染。AI 爬虫在抓取根路径 `/` 时，只能拿到几乎空白的 HTML shell，无法了解网站的用途和使用方法。

手工告知 AI "去读 /docs 页面"不够可靠，AI 不会主动猜测其他路径。需要在根路径 `/` 层面解决。

## Solution Overview

双管齐下：

1. **Edge Function 检测 AI 爬虫 User-Agent** — 当检测到 AI 爬虫访问 `/` 时，在返回的 SPA shell 中嵌入 JSON-LD 结构化数据和 Open Graph Meta 标签
2. **`/docs` 路径作为 AI 文档入口** — 使用 Markdown 书写完整使用指南，存储在 KV `docs` key 中，通过 `/{key}` 路由以 `text/plain` 返回

## Data Flow

```
AI 爬虫请求 https://text.hunluan.space/
  └─ EdgeOne Edge Function
      ├─ 检测 User-Agent → 匹配爬虫列表
      │   ├─ 是爬虫 → 在 index.html <head> 注入 JSON-LD + OG meta
      │   └─ 普通用户 → 返回原始 index.html（不变）
      └─ 返回给爬虫的 HTML 中包含:
          <script type="application/ld+json">...</script>
          <meta property="og:..." ...>
```

```
AI 爬虫请求 https://text.hunluan.space/docs
  └─ EdgeOne `/{key}` 路由
      └─ 返回 KV docs key 的内容
          Content-Type: text/plain; charset=utf-8
          ← 纯 Markdown 文本，AI 直接解析
```

## User-Agent Detection

### 数据源

采用三个数据源合并维护爬虫 UA 列表：

| 数据源 | 格式 | 用途 |
|--------|------|------|
| [ai.robots.txt](https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/main/robots.json) | JSON（含 UA 名称列表） | AI 爬虫主体 |
| [crawler-user-agents](https://raw.githubusercontent.com/monperrus/crawler-user-agents/master/crawler-user-agents.json) | JSON（含 pattern 正则） | 通用爬虫补充 |
| [top-crawler-agents](https://raw.githubusercontent.com/Kikobeats/top-crawler-agents/master/index.json) | JSON（纯字符串数组） | 常见爬虫补充 |

### 自动化维护方案

- GitHub Actions 定时任务（每周或每月）拉取上述三个数据源
- 合并去重后生成 `ai-crawler-agents.json`，提交到仓库
- Edge Function 读取该 JSON 进行 UA 匹配

### 首次实现

直接硬编码最常用的 AI 爬虫 UA 片段（不依赖外部文件），后续通过 GitHub Actions 扩展：

```
Claude-Web, GPTBot, ChatGPT-User, CCBot, PerplexityBot,
Anthropic-AI, Amazonbot, Bytespider, Applebot-Extended,
FacebookBot, ImagesiftBot, Timpibot, cohere-ai,
Diffbot, DataForSeoBot, omgili, Google-Extended
```

## JSON-LD Schema

```json
{
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
}
```

## KV Document Content

存储在 KV `docs` key 中的内容为 Markdown 格式，包含：

- 平台概述
- 核心功能（单文件操作、文件夹上传、密码保护）
- 详细使用步骤
- 访问路由说明
- 技术说明与 FAQ

通过 WriteCard 写入，密码 `311113qaz` 保护防止被覆盖。

## Edge Function Changes

在 `build-edge.cjs` 生成的 edge function 中，找到返回 `index.html` 的片段，在 `<head>` 标签闭合前注入：

```js
// AI 爬虫检测
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

// 在返回 index.html 的响应前
const requestUA = request.headers.get('User-Agent') || '';
const html = STATIC_FILES['/index.html']; // 原始 HTML
if (isAiCrawler(requestUA)) {
  const jsonLd = JSON.stringify({...}); // 上述 JSON-LD 内容
  const enriched = html.replace(
    '</head>',
    `<script type="application/ld+json">${jsonLd}</script>\n</head>`
  );
  return new Response(enriched, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
```

## No Impact on Other Routes

- 子路径（`/{key}`、`/p/{key}`、`/file/*`、`/md/{key}`）完全不受影响
- 检测逻辑仅在 `/` 根路径的响应中生效
- 普通用户浏览器访问不受任何影响（JSON-LD 对用户不可见）

## Future Improvements

- GitHub Actions 定期更新 AI 爬虫 UA 列表
- 可考虑在 `/robots.txt` 中引导 AI 爬虫优先抓取 `/docs`
- 如后期新增多语言 UI，可扩展 JSON-LD 支持多语言描述
