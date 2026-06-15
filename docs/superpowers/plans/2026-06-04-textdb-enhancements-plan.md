> **Status: ✅ 已完成** — 2026-06-04 实施，已合入 master。本文档保留作为历史参考。

# TextDB EdgeOne 后续增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 4 项增强：URL 交互优化、Markdown 渲染路由、上传增强、文件夹上传（极简静态站点部署器）。

**Architecture:** 边缘函数最小改动（仅加 `/md/*` → SPA 路由），其余逻辑全在前端。新增 `MdRenderer`、`FolderUpload` 两个组件，`folderUtils.ts` 工具模块，`api.ts` 新增 `uploadFile()`。

**简化说明：** 设计文档中的"Key 冲突预检"暂不实施——文件夹上传直接覆盖已有 Key（与现有 `POST /update/` 行为一致），避免 N+1 次 GET 请求增加复杂度。后续可单独迭代。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui，新增 react-markdown + remark-gfm

---

## File Structure

```
Modified:
  src/components/WriteCard.tsx         — Feature 1: URL 交互优化 + Feature 3: 上传增强
  src/App.tsx                          — Feature 2: /md/ 路由分发 + Feature 4: FolderUpload 集成
  src/api.ts                           — Feature 4: batchUpload() 批量上传
  build-edge.cjs                       — Feature 2: /md/* 返回 SPA

Created:
  src/components/MdRenderer.tsx        — Feature 2: Markdown 渲染页面组件
  src/components/FolderUpload.tsx      — Feature 4: 文件夹上传组件
  src/lib/folderUtils.ts              — Feature 4: pathToKey(), rewriteRefs(), isBinary()

New deps:
  react-markdown, remark-gfm
```

### Responsibilities

| File | Responsibility |
|------|---------------|
| `WriteCard.tsx` | 单条写入、文件上传、URL 展示 |
| `MdRenderer.tsx` | 从 pathname 提取 key → 调 API 获取 Markdown → react-markdown 渲染 |
| `FolderUpload.tsx` | 文件夹选择器、文件预览列表、批量上传进度、结果汇总 |
| `folderUtils.ts` | 纯函数：文件名→Key 映射、HTML 引用改写、二进制检测 |

---

### Task 1: 安装依赖

**Files:** `package.json`

- [ ] **Step 1: 安装 react-markdown + remark-gfm**

```bash
npm install react-markdown remark-gfm
```

Expected: 两个包添加到 package.json dependencies

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and remark-gfm dependencies

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Feature 1 (URL 交互优化) + Feature 3 (上传增强)

**Files:**
- Modify: `src/components/WriteCard.tsx`

These two features touch the same file and are small enough to do together.

- [ ] **Step 1: 修改 WriteCard.tsx — accept 列表、按钮文案、URL 展示逻辑**

Replace the entire `WriteCard.tsx` with the updated version:

```tsx
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, Loader2, Shuffle, Trash2, Upload } from "lucide-react";
import { writeData, deleteData } from "@/api";
import { toast } from "sonner";

const BASE = location.origin;

const TEXT_ACCEPT = [
  ".txt", ".log", ".csv", ".tsv",
  ".html", ".htm", ".css", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".scss", ".sass", ".less",
  ".json", ".xml", ".svg", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env", ".properties",
  ".md", ".mdx", ".rst", ".tex",
  ".sh", ".bash", ".zsh", ".py", ".rb", ".php", ".pl", ".lua",
  ".c", ".cpp", ".h", ".hpp", ".rs", ".go", ".java", ".kt", ".swift", ".sql",
  ".graphql", ".gradle", ".proto", ".Dockerfile", ".editorconfig",
].join(",");

/** Heuristic: does the value look like HTML? */
function looksLikeHtml(value: string): boolean {
  const s = value.trimStart();
  return (
    s.startsWith("<!") ||
    s.startsWith("<html") ||
    s.startsWith("<body") ||
    s.startsWith("<head") ||
    s.includes("</html>") ||
    s.includes("</body>") ||
    s.includes("</head>")
  );
}

export function WriteCard() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");   // /{key} 源链接
  const [renderUrl, setRenderUrl] = useState("");    // /p/{key} HTML 渲染链接（仅 HTML）

  function genKey() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let k = "k_";
    for (let i = 0; i < 16; i++) k += c[Math.floor(Math.random() * c.length)];
    setKey(k);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB（服务端限制）
    if (file.size > MAX_SIZE) {
      toast.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 5 MiB`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast.error("文件读取失败");
    reader.onload = () => {
      const text = reader.result as string;
      setValue(text);
      if (!key) genKey();
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleWrite() {
    if (!key) return toast.error("请输入 Key");
    if (!value) return toast.error("请输入内容");
    setLoading(true);
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    try {
      const d = await writeData(key, value);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) {
        setSourceUrl(`${BASE}/${key}`);
        if (looksLikeHtml(value)) {
          setRenderUrl(`${BASE}/p/${key}`);
        }
        toast.success("写入成功");
      } else toast.error(d.error || "写入失败");
    } catch (e: any) {
      setResult("请求失败: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!key) return toast.error("请输入 Key");
    setLoading(true);
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    try {
      const d = await deleteData(key);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) toast.success("已删除");
      else toast.error(d.error || "删除失败");
    } catch (e: any) {
      setResult("请求失败: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>写入 / 更新</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="my_data_key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={genKey}>
            <Shuffle />
          </Button>
        </div>
        <Textarea
          placeholder="在此输入文本内容..."
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="font-mono"
        />

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="relative">
            <Upload />
            上传文本文件
            <input
              type="file"
              accept={TEXT_ACCEPT}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
          </Button>
          <p className="text-xs text-muted-foreground">
            支持 HTML/CSS/JS/MD 等文本文件，可在文件对话框切换"所有文件"
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleWrite} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            写入
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={loading}>
            <Trash2 />
            删除此 Key
          </Button>
        </div>

        {/* 源链接（始终显示） */}
        {sourceUrl && (
          <div className="rounded-md border bg-muted p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-4 break-all flex-1"
            >
              {sourceUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(sourceUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}

        {/* HTML 渲染链接（仅 HTML 内容时显示） */}
        {renderUrl && (
          <div className="rounded-md border bg-primary/5 p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-primary" />
            <a
              href={renderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary underline underline-offset-4 break-all flex-1"
            >
              {renderUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(renderUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}

        {result && (
          <pre className="rounded-md border bg-muted p-4 text-sm font-mono break-all max-h-48 overflow-auto">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

Expected: Build succeeds, edge function generated

- [ ] **Step 4: Commit**

```bash
git add src/components/WriteCard.tsx
git commit -m "feat: URL 交互优化 + 上传增强

- 写入成功后始终显示源链接 /{key}
- 检测到 HTML 内容时额外显示 /p/{key} 渲染链接
- accept 扩展至 40+ 常见文本格式
- 按钮文案改为"上传文本文件"

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Feature 2 — Markdown 渲染路由

**Files:**
- Create: `src/components/MdRenderer.tsx`
- Modify: `src/App.tsx` (add /md/ pathname detection)
- Modify: `build-edge.cjs` (add /md/ → SPA routing)

- [ ] **Step 1: 创建 MdRenderer.tsx**

Create `src/components/MdRenderer.tsx`:

```tsx
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readData } from "@/api";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BASE = location.origin;

export function MdRenderer() {
  const key = location.pathname.slice(4); // remove "/md/"
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const text = await readData(key);
        if (!text) {
          setError("Key 不存在或内容为空");
        } else {
          setMarkdown(text);
        }
      } catch (e: any) {
        setError("加载失败: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <a href="/" className="text-primary underline">返回首页</a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header bar */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b">
        <a href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" />
          返回首页
        </a>
        <a
          href={`${BASE}/${key}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ExternalLink className="size-4" />
          /{key}
        </a>
      </header>

      {/* Markdown content */}
      <article className="prose dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {markdown}
        </ReactMarkdown>
      </article>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          md/{key}
        </span>
        <Button variant="ghost" size="sm" onClick={copyUrl}>
          <Copy className="size-4" />
          复制链接
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 App.tsx — 添加 /md/ 路由分发**

Read the current `App.tsx`, then replace it. The key change: at the start of the component, check `window.location.pathname` — if it starts with `/md/`, render `<MdRenderer>` instead of the normal App layout.

Replace `src/App.tsx`:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WriteCard } from "@/components/WriteCard";
import { ReadCard } from "@/components/ReadCard";
import { ApiDocs } from "@/components/ApiDocs";
import { MdRenderer } from "@/components/MdRenderer";
import { FolderUpload } from "@/components/FolderUpload";
import { Toaster } from "@/components/ui/sonner";
import { Database } from "lucide-react";

export default function App() {
  // /md/{key} 路由 — SPA 自行解析
  if (window.location.pathname.startsWith("/md/")) {
    return (
      <>
        <MdRenderer />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-3">
          <Database className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TextDB EdgeOne</h1>
            <p className="text-sm text-muted-foreground">
              基于 EdgeOne Pages + KV 的在线文本数据库
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Tabs defaultValue="operate" className="flex flex-col gap-6">
          <TabsList>
            <TabsTrigger value="operate">操作</TabsTrigger>
            <TabsTrigger value="api">API 文档</TabsTrigger>
          </TabsList>

          <TabsContent value="operate" className="flex flex-col gap-6 mt-0">
            <WriteCard />
            <FolderUpload />
            <ReadCard />
          </TabsContent>

          <TabsContent value="api" className="mt-0">
            <ApiDocs />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          TextDB EdgeOne ·{" "}
          <a
            href="https://github.com/sixiang-world/textdb-edgeone"
            className="hover:text-foreground transition"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>

      <Toaster />
    </>
  );
}
```

Note: `FolderUpload` import is added here but the component doesn't exist yet — it will be created in Task 5. For now, the build will fail on this import. See Step 3 notes.

- [ ] **Step 3: 创建 FolderUpload 占位组件（使编译通过）**

Create `src/components/FolderUpload.tsx` as a minimal placeholder:

```tsx
export function FolderUpload() {
  return null; // Placeholder — implemented in Task 5
}
```

- [ ] **Step 4: 修改 build-edge.cjs — 添加 /md/* 路由**

In `build-edge.cjs`, after the `/p/` route block (line that starts with `if (request.method === 'GET' && path.startsWith('/p/'))`), add the Markdown routing block.

The `/p/` route block ends with a closing `}` followed by a blank line. Insert the new block right after it.

```js
  // Markdown 渲染路由 /md/{key} — 返回 SPA，前端自行解析渲染
  if (request.method === 'GET' && path.startsWith('/md/')) {
    const key = path.slice(4);
    if (key && /^[0-9a-zA-Z_]{1,512}$/.test(key)) {
      return new Response(STATIC_FILES['/index.html'], {
        headers: {'Content-Type': 'text/html; charset=utf-8', ...CORS}
      });
    }
    return new Response('Invalid Key', {status: 400, headers: CORS});
  }
```

The exact insertion point is after the `/p/` route closing `}` and its blank line, before the `// KV 测试路由` comment.

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: No errors (FolderUpload placeholder resolves the import)

- [ ] **Step 6: 验证构建**

```bash
npm run build
```

Expected: Build succeeds, edge function includes the /md/ routing block

- [ ] **Step 7: Commit**

```bash
git add src/components/MdRenderer.tsx src/components/FolderUpload.tsx src/App.tsx build-edge.cjs
git commit -m "feat: Markdown 渲染路由 /md/{key}

- 新增 MdRenderer 组件，react-markdown + remark-gfm 渲染
- App.tsx 检测 /md/ pathname 分发到 MdRenderer
- build-edge.cjs 添加 /md/* → SPA 路由
- 添加 FolderUpload 占位组件

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Feature 4 — 工具函数模块

**Files:**
- Create: `src/lib/folderUtils.ts`

- [ ] **Step 1: 创建 src/lib/ 目录并编写 folderUtils.ts**

```bash
mkdir -p src/lib
```

Create `src/lib/folderUtils.ts`:

```typescript
const BASE = typeof location !== "undefined" ? location.origin : "";

/**
 * 文件名 → KV Key 映射
 * 规则：前缀 + 相对路径，/ 和 . 替换为 _
 *
 *   index.html       → mysite_index_html
 *   css/style.css    → mysite_css_style_css
 *   js/utils/date.js → mysite_js_utils_date_js
 */
export function pathToKey(prefix: string, relativePath: string): string {
  // Normalize: remove leading ./ or ../
  let p = relativePath.replace(/^\.{1,2}\//, "");
  // Replace separators: / and . → _
  p = p.replace(/[\/.]/g, "_");
  return `${prefix}_${p}`;
}

/**
 * HTML 引用改写：将 <link href> 和 <script src> 的相对路径
 * 替换为上传后的远程 URL
 */
export function rewriteRefs(
  html: string,
  prefix: string,
  fileMap: Map<string, string>  // relativePath → KV key
): string {
  let result = html;

  // Rewrite <link href="...">
  result = result.replace(
    /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, url: string) => {
      if (isAbsoluteUrl(url)) return match;
      const resolved = resolveRelative(url, fileMap, prefix);
      if (!resolved) return match;
      return match.replace(url, `${BASE}/${resolved}`);
    }
  );

  // Rewrite <script src="...">
  result = result.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, url: string) => {
      if (isAbsoluteUrl(url)) return match;
      const resolved = resolveRelative(url, fileMap, prefix);
      if (!resolved) return match;
      return match.replace(url, `${BASE}/${resolved}`);
    }
  );

  return result;
}

/** Check if a URL is absolute (starts with http://, https://, //, data:) */
function isAbsoluteUrl(url: string): boolean {
  return /^(https?:)?\/\/|^data:/i.test(url);
}

/** Resolve a relative path against the fileMap */
function resolveRelative(
  url: string,
  fileMap: Map<string, string>,
  prefix: string
): string | null {
  const normalized = url.replace(/^\.{1,2}\//, "");
  const key = fileMap.get(normalized);
  if (key) return key;
  // Fallback: compute from prefix via pathToKey
  return pathToKey(prefix, normalized);
}

/**
 * 构建相对路径 → KV Key 的映射表
 */
export function buildFileMap(
  prefix: string,
  files: Array<{ relativePath: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of files) {
    const normalized = f.relativePath.replace(/^\.{1,2}\//, "");
    map.set(normalized, pathToKey(prefix, f.relativePath));
  }
  return map;
}

/**
 * 启发式二进制检测：检查前 1000 字符中 null 字节或非打印字符比例
 */
export function isBinary(content: string): boolean {
  const sample = content.slice(0, 1000);
  if (sample.length === 0) return false;
  let weird = 0;
  for (let i = 0; i < sample.length; i++) {
    const ch = sample.charCodeAt(i);
    if (ch === 0 || (ch < 9 && ch !== 10 && ch !== 13)) {
      weird++;
    }
  }
  return weird / sample.length > 0.1;
}

export interface UploadItem {
  relativePath: string;
  name: string;
  content: string;
  key: string;
}

export interface UploadResult {
  key: string;
  name: string;
  success: boolean;
  error?: string;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/folderUtils.ts
git commit -m "feat: 文件夹上传工具函数 (pathToKey, rewriteRefs, isBinary)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Feature 4 — FolderUpload 组件

**Files:**
- Modify: `src/components/FolderUpload.tsx` (replace placeholder)
- Modify: `src/api.ts` (add batchUpload)

- [ ] **Step 1: 在 api.ts 中添加 uploadFile()**

Add to `src/api.ts`:

```typescript
import type { UploadItem, UploadResult } from "@/lib/folderUtils";

export async function uploadFile(file: UploadItem): Promise<UploadResult> {
  try {
    const res = await fetch(`${BASE}/update/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(file.key)}&value=${encodeURIComponent(file.content)}`,
    });
    const data = await res.json();
    return {
      key: file.key,
      name: file.name,
      success: data.status === 1,
      error: data.status !== 1 ? (data.error || "Unknown error") : undefined,
    };
  } catch (e: any) {
    return {
      key: file.key,
      name: file.name,
      success: false,
      error: e.message,
    };
  }
}
```

- [ ] **Step 2: 替换 FolderUpload.tsx 占位为完整实现**

Replace `src/components/FolderUpload.tsx`:

```tsx
import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Copy, ExternalLink, FolderOpen, Loader2, Shuffle, Upload } from "lucide-react";
import { uploadFile } from "@/api";
import { pathToKey, rewriteRefs, buildFileMap, isBinary } from "@/lib/folderUtils";
import type { UploadItem, UploadResult } from "@/lib/folderUtils";
import { toast } from "sonner";

const BASE = location.origin;

export function FolderUpload() {
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [entryUrl, setEntryUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function genPrefix() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let p = "site_";
    for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
    setPrefix(p);
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (!prefix) genPrefix();

    const items: UploadItem[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      // webkitRelativePath gives the relative path within the folder
      const relPath = (f as any).webkitRelativePath || f.name;

      // Read file content
      const reader = new FileReader();
      reader.onerror = () => {
        skipped.push(relPath);
      };
      reader.onload = (ev) => {
        const content = ev.target?.result as string;

        if (isBinary(content)) {
          skipped.push(relPath);
          return;
        }

        items.push({
          relativePath: relPath,
          name: f.name,
          content,
          key: pathToKey(prefix, relPath),
        });

        // When all files processed, update state
        if (items.length + skipped.length === fileList.length) {
          if (skipped.length > 0) {
            toast.warning(`跳过 ${skipped.length} 个二进制文件`);
          }
          setFiles(prev => [...prev, ...items]);
        }
      };
      reader.readAsText(f);
    }

    e.target.value = "";
  }

  async function handleUpload() {
    if (files.length === 0) return toast.error("请先选择文件夹");
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setResults([]);
    setEntryUrl("");

    // Build file map & rewrite HTML refs
    const fileMap = buildFileMap(prefix, files);
    const toUpload: UploadItem[] = files.map(f => {
      if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
        return {
          ...f,
          content: rewriteRefs(f.content, prefix, fileMap),
        };
      }
      return f;
    });

    // Upload one-by-one (respect rate limits, track progress)
    const allResults: UploadResult[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      const res = await uploadFile(toUpload[i]);
      allResults.push(res);
      setProgress({ done: i + 1, total: toUpload.length });
    }

    setResults(allResults);
    setUploading(false);

    const succeeded = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    toast.success(`上传完成: ${succeeded} 成功${failed > 0 ? `, ${failed} 失败` : ""}`);

    // Find entry point (index.html)
    const entry = toUpload.find(
      f => f.relativePath.endsWith("/index.html") || f.relativePath === "index.html"
    );
    if (entry) {
      setEntryUrl(`${BASE}/p/${entry.key}`);
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>文件夹上传</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Project prefix + folder picker */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="项目前缀 (如 mysite)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={genPrefix} title="随机生成">
            <Shuffle className="size-4" />
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            className="relative"
            disabled={uploading}
          >
            <FolderOpen />
            选择文件夹
            <input
              ref={inputRef}
              type="file"
              // @ts-ignore webkitdirectory is supported in all modern browsers
              webkitdirectory=""
              // @ts-ignore
              directory=""
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFolderSelect}
            />
          </Button>
          <span className="text-xs text-muted-foreground">
            选择包含 HTML/CSS/JS 的文件夹
          </span>
        </div>

        {/* File list preview */}
        {files.length > 0 && (
          <div className="rounded-md border bg-muted p-3 text-sm font-mono max-h-48 overflow-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground truncate flex-1">
                  📄 {f.relativePath}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  → {f.key}
                </span>
                {!uploading && (
                  <button
                    onClick={() => removeFile(i)}
                    className="ml-2 text-xs text-destructive hover:underline shrink-0"
                  >
                    移除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {files.length > 0 && !uploading && !results.length && (
          <Button onClick={handleUpload} className="w-full">
            <Upload />
            上传 {files.length} 个文件
          </Button>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              上传中... {progress.done}/{progress.total}
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && (
          <div className="rounded-md border p-4 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span>
                ✅ {results.filter(r => r.success).length} 成功
                {results.filter(r => !r.success).length > 0 && (
                  <span className="text-destructive ml-2">
                    ❌ {results.filter(r => !r.success).length} 失败
                  </span>
                )}
              </span>
            </div>
            {results.filter(r => !r.success).length > 0 && (
              <div className="text-xs text-muted-foreground max-h-24 overflow-auto">
                {results.filter(r => !r.success).map((r, i) => (
                  <div key={i}>{r.key}: {r.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entry link */}
        {entryUrl && (
          <div className="rounded-md border bg-primary/5 p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-primary" />
            <a
              href={entryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary underline underline-offset-4 break-all flex-1"
            >
              {entryUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(entryUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 检查 Progress 组件是否存在**

```bash
ls src/components/ui/progress.tsx 2>/dev/null || echo "NOT FOUND"
```

If NOT FOUND, create it via shadcn:

```bash
npx shadcn add progress
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are TS errors about `webkitdirectory`, note that we used `@ts-ignore` — verify the comment is correct.

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/FolderUpload.tsx src/api.ts src/components/ui/progress.tsx 2>/dev/null
git commit -m "feat: 文件夹上传组件 + 批量上传 API

- FolderUpload: webkitdirectory 文件夹选择、文件预览、进度条、结果汇总
- batchUpload: 逐个上传避免限流
- 集成 pathToKey/rewriteRefs/isBinary 工具函数

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 清理 & 最终验证

**Files:**
- Modify: `src/components/ApiDocs.tsx` (add /md/{key} endpoint to docs)

- [ ] **Step 1: 更新 API 文档**

In `src/components/ApiDocs.tsx`, update the `endpoints` array to include the new `/md/{key}` endpoint:

Find the `endpoints` array and modify it to include the Markdown route:

```tsx
const endpoints = [
  { method: "POST", color: "default" as const, path: "/update/", desc: "写入 / 更新 / 删除" },
  { method: "GET", color: "secondary" as const, path: "/{key}", desc: "读取数据（原始文本）" },
  { method: "GET", color: "secondary" as const, path: "/p/{key}", desc: "HTML 渲染" },
  { method: "GET", color: "secondary" as const, path: "/md/{key}", desc: "Markdown 渲染" },   // 新增
  { method: "POST", color: "default" as const, path: "/{key}", desc: "直接写入（简写）" },
  { method: "DELETE", color: "destructive" as const, path: "/{key}", desc: "删除数据" },
];
```

Also update the params description — change the max size from 3MB to 5 MiB (fixing a stale doc comment):

```tsx
const params = [
  { name: "key", required: true, desc: "文本标识，仅支持字母、数字、下划线，最长 512 字符" },
  { name: "value", required: false, desc: "文本数据，最大 5 MiB。留空则删除" },
];
```

- [ ] **Step 2: 最终构建验证**

```bash
npm run build
```

Expected: Clean build, no errors or warnings

- [ ] **Step 3: Commit**

```bash
git add src/components/ApiDocs.tsx
git commit -m "docs: 更新 API 文档 — 添加 /md/{key} 端点，修正 value 上限

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete:

1. `npm run build` succeeds (tsc + vite + build-edge)
2. Edge function includes `/md/*` routing
3. `WriteCard`: accept list has 40+ formats, button says "上传文本文件"
4. `App.tsx`: detects `/md/` pathname, renders MdRenderer
5. `FolderUpload`: renders in App, webkitdirectory input present
6. `folderUtils.ts`: pathToKey/rewriteRefs/isBinary all exported
7. `api.ts`: uploadFile function exported
