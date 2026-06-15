> **Status: ✅ 已完成** — 2026-06-04 实施，已合入 master。本文档保留作为历史参考。

# TextDB EdgeOne 后续增强设计

2026-06-04

## 概述

4 项功能增强：URL 交互优化、Markdown 渲染路由、上传增强、文件夹上传。

核心原则：**边缘函数最小改动，大部分逻辑放在前端。**

## 架构（不变）

```
浏览器 (React SPA)
    │ fetch() API
    ▼
边缘函数 [[default]].js
    ├── 静态文件服务 (index.html, JS, CSS)
    ├── API 路由 (POST/GET/DELETE)
    ├── GET /p/{key} → HTML 渲染 (已有)
    └── GET /md/* → 返回 index.html (新增，SPA 接管路由)
         │
         ▼
    KV 存储 (TEXTDB)
```

## 功能 1：URL 交互优化

**目标**：写入成功后正确展示源链接和 HTML 渲染链接。

**改动文件**：`src/components/WriteCard.tsx`

**逻辑**：
- 写入成功后**始终**显示源链接 `/{key}`（可点击跳转 + 复制按钮）
- 前端启发式检测 value 是否为 HTML（检查 `<!DOCTYPE`、`<html`、`<body` 等标记）
- 仅当检测为 HTML 时，**额外**显示渲染链接 `/p/{key}`

**HTML 检测规则**（前端）：
```
value.trimStart() 以 "<!"、"<html"、"<body"、"<head" 开头
或 value 包含 "</html>"、"</body>"、"</head>"
```

**UI 效果**：
- 普通文本写入 → 只显示源链接
- HTML 写入 → 显示源链接 + HTML 渲染链接（两行）

## 功能 2：Markdown 渲染路由（前端方案 A）

**目标**：`/md/{key}` 分享链接，在浏览器中渲染 Markdown 为美化 HTML。

**新增依赖**：`react-markdown` + `remark-gfm`

### 边缘函数改动

`build-edge.cjs`：在 `/p/` 路由之后、静态文件/API 之前，添加 `/md/` 路径检测，返回 index.html 让 SPA 接管。

```js
// /p/ 路由之后插入（第 126 行附近）：

// Markdown 渲染路由 /md/{key} — 返回 SPA，前端自行解析渲染
if (request.method === 'GET' && path.startsWith('/md/')) {
  return new Response(STATIC_FILES['/index.html'], {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS }
  });
}
```

注意：**不是**所有未知路径兜底，仅 `/md/` 前缀。`GET /{key}` 仍走原有 API 逻辑正确读取 KV 数据。

### 前端改动

**App.tsx**：启动时检测 `window.location.pathname`，若以 `/md/` 开头则渲染 `<MdRenderer>`。

**MdRenderer.tsx**（新文件）：
- 从 pathname 提取 key（`/md/my_doc` → `my_doc`）
- 调用 `readData(key)` 获取原始 Markdown 文本
- 用 `<ReactMarkdown remarkPlugins={[remarkGfm]}>` 渲染
- 安全措施：仅渲染 Markdown（不同于 `/p/` 直接返回原始 HTML — `/p/` 有 CSP 安全头），Markdown 是安全的纯文本转换

**Markdown 页面布局**：
```
┌──────────────────────────────────────────┐
│  ← 返回首页          TextDB EdgeOne       │
│──────────────────────────────────────────│
│  📄 md/my_doc                            │
│  ┌────────────────────────────────────┐  │
│  │  渲染后的 Markdown 内容             │  │
│  │  (标题/表格/代码块/GFM)             │  │
│  └────────────────────────────────────┘  │
│  原始文本: /my_doc  [复制链接]            │
└──────────────────────────────────────────┘
```

## 功能 3：上传增强

**目标**：上传按钮从 "仅 HTML" 变为 "任意文本文件"。

**改动文件**：`src/components/WriteCard.tsx`

**改动点**：
1. `accept` 属性扩展为 40+ 常见文本格式
2. 按钮文案从 "上传 HTML 文件" → "上传文本文件"
3. 添加提示文字 "支持 HTML/CSS/JS/MD 等文本文件"

**accept 列表**：
```
.txt,.log,.csv,.tsv
.html,.htm,.css,.js,.jsx,.ts,.tsx,.vue,.svelte,.scss,.sass,.less
.json,.xml,.svg,.yaml,.yml,.toml,.ini,.cfg,.conf,.env,.properties
.md,.mdx,.rst,.tex
.sh,.bash,.zsh,.py,.rb,.php,.pl,.lua
.c,.cpp,.h,.hpp,.rs,.go,.java,.kt,.swift,.sql
.graphql,.gradle,.proto,.Dockerfile,.editorconfig
```

用户在文件对话框中可切换 "所有文件" 选择任意格式，accept 仅作为默认过滤器。

## 功能 4：文件夹上传（核心）

**目标**：上传整个 HTML + CSS + JS 文件夹，自动改写路径引用，实现极简静态站点部署。

**Key 命名规则**：不改变现有规则 `^[0-9a-zA-Z_]{1,512}$`。文件名通过压平映射为合法 Key。

### 文件命名映射 `pathToKey()`

```
规则：prefix + 相对路径，/ 和 . 替换为 _
示例（prefix = mysite）：

  index.html        → mysite_index_html
  css/style.css     → mysite_css_style_css
  js/app.js         → mysite_js_app_js
  js/utils/date.js  → mysite_js_utils_date_js
```

### HTML 引用改写 `rewriteRefs()`

上传前扫描 HTML 文件，将 `<link href>` 和 `<script src>` 中指向**其他文本文件**的相对路径替换为对应文件上传后的远程 URL：

```html
<!-- 改写前 -->
<link rel="stylesheet" href="./css/style.css">
<script src="./js/app.js"></script>

<!-- 改写后 -->
<link rel="stylesheet" href="https://{origin}/mysite_css_style_css">
<script src="https://{origin}/mysite_js_app_js"></script>
```

**改写范围限定**：
- ✅ `<link href>` 和 `<script src>` 指向 CSS/JS 等文本文件
- ❌ `<a href>`、`<img src>` 不处理
- ❌ CSS `url()` 不处理（目标文件为二进制）
- ❌ 绝对 URL（`https://...`）不处理

### 二进制文件跳过

上传时检查文件内容是否包含 null 字节或高比例非打印字符。若是，跳过该文件并提示用户。

### 上传流程

1. 用户输入项目前缀（如 `mysite`）+ 选择文件夹
2. 前端遍历 `e.target.files`，构建文件列表
3. 对每个文本文件：
   - 计算映射 Key (`pathToKey`)
   - 若为 HTML → `rewriteRefs()` 改写内部引用
   - `POST /update/` 写入 KV
4. 显示上传进度 "已上传 3/12"
5. 完成后展示站点入口链接 `/p/mysite_index_html`

### 引入的新组件 `FolderUpload.tsx`

- `webkitdirectory` 属性实现文件夹选择
- 文件列表预览（名称 → Key 映射展示）
- 批量上传进度条
- 上传结果汇总

### 引入的新 API 函数 `batchUpload()`

```ts
// api.ts 新增
async function batchUpload(files: UploadItem[]): Promise<UploadResult[]>
```

遍历文件列表，逐个调用 `POST /update/`。不做并发限制（逐个上传避免边缘函数限流）。
上传前检查目标 Key 是否已存在，若存在则提示用户确认覆盖。

## Key 冲突处理

文件夹上传时，若某个映射 Key 已存在：
- 前端在上传前调用 `GET /{key}` 批量检查
- 若存在冲突，展示冲突列表，用户确认是否覆盖
- 用户可选择 "跳过" 或 "覆盖全部"

## 安全考虑

| 功能 | 安全措施 |
|------|----------|
| `/p/{key}` | 已有 CSP 头（`script-src 'unsafe-inline'` 等），不变 |
| `/md/{key}` | react-markdown 默认不渲染 HTML 标签，XSS 安全 |
| 文件夹上传 | 二进制过滤，Key 规则不变 |
| 文件上传 | 客户端 5 MiB 大小检查，服务端也有同样检查 |

## 非功能需求

- 所有改动不引入 npm 包到 Edge Function（前端包不受限）
- 不修改 KV 存储 API 签名
- 二进制文件（图片/字体/视频）本轮不支持，后续评估

## 测试要点

1. URL 交互：写入普通文本 → 仅显示源链接；写入 HTML → 显示双链接
2. Markdown：直接访问 `/md/{key}` → 渲染页面；不存在 key → 显示 "Not Found"
3. 上传增强：accept 列表包含新增格式，可切换"所有文件"
4. 文件夹上传：选择文件夹 → 文件列表预览 → 批量上传 → 访问 `/p/prefix_index_html` 渲染完整页面
5. HTML 改写：CSS/JS 引用正确替换为远程 URL，二进制引用不变
