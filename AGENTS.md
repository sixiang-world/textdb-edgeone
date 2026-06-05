# TextDB EdgeOne

基于 EdgeOne Pages + KV 的在线文本数据库。匿名写入/读取，无用户系统。

## 架构

- **前端**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui（radix-nova 样式）
- **后端**: EdgeOne Edge Functions（V8 运行时）+ KV 存储（全局变量 `TEXTDB`）
- **部署**: GitHub 集成自动部署（push 即部署），不支持 CLI 部署
- **样式**: 极简线条风格，按钮/标签带有浮起→按压的 3D 阴影效果（shadow-based）

## 关键文件

| 文件 | 作用 |
|------|------|
| `build-edge.cjs` | 构建脚本 — Vite 构建产物内嵌到 edge function 源码 |
| `edge-functions/[[default]].js` | 构建产物（边缘函数源码），别直接编辑 |
| `src/App.tsx` | 前端主应用 |
| `src/api.ts` | API 调用封装 |
| `src/components/WriteCard.tsx` | 写入/上传组件 |
| `src/components/ReadCard.tsx` | 读取组件 |
| `src/components/FolderUpload.tsx` | 文件夹上传组件（webkitdirectory） |
| `src/components/ApiDocs.tsx` | API 文档面板 |
| `src/components/MdRenderer.tsx` | Markdown 渲染路由 /md/{key} |
| `src/lib/folderUtils.ts` | 文件夹上传工具函数（pathToKey, rewriteRefs, isBinary） |
| `src/components/ui/button.tsx` | Button 组件（default/outline/secondary/ghost/destructive/link） |
| `src/components/ui/tabs.tsx` | Tabs 组件（default/line variant） |
| `src/components/ui/input.tsx` | Input 组件 |
| `src/components/ui/textarea.tsx` | Textarea 组件 |
| `src/components/ui/progress.tsx` | Progress 进度条组件（文件夹上传用） |
| `index.html` | Vite 入口 HTML |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/update/` | 写入/更新/删除（JSON `{key, value}` 或 FormData） |
| `POST` | `/{key}` | 直接写入（请求体为内容） |
| `GET` | `/{key}` | 读取原始内容（`text/plain`） |
| `GET` | `/p/{key}` | HTML 渲染读取（含 CSP 安全头） |
| `GET` | `/md/{key}` | Markdown 渲染（返回 SPA，前端解析渲染） |
| `DELETE` | `/{key}` | 删除 |
| `OPTIONS` | 任意 | CORS 预检 |

## 功能

### 文件夹上传
- 通过 `webkitdirectory` 选择文件夹上传
- 自动生成项目前缀（或手动输入）
- 文件内容读取（FileReader），跳过二进制文件
- HTML 引用改写（rewriteRefs）：`<link href>` 和 `<script src>` 的相对路径改写为 KV 直链
- 支持嵌套目录（如 `00000/css/style.css`）
- 30 秒安全超时、onabort 兜底
- 上传进度条 + 结果统计

### HTML 渲染 /p/{key}
- 带 Content-Security-Policy 安全头
- CSP: `default-src 'self'`，允许内联脚本样式和同源外部资源
- 用于渲染上传的 HTML 站点

### Markdown 渲染 /md/{key}
- 前端渲染 Markdown 内容
- 返回 SPA，前端解析 Key 并显示

## 样式约定

- **按钮三态**: 浮起（`shadow-[0_3px_0]`）→ 悬浮（`inset shadow + translate-y-px`）→ 点击（更深 inset shadow + translate-y-[2px]）
- **标签切换三态**: 同上，选中额外加 `bg-muted`
- **输入框聚焦**: 2px 环 + 40% 边框色，保持轻盈
- **主题变量**: `src/index.css` 通过 `@theme inline` 定义 `--color-ring: oklch(0.708 0 0)` 修复聚焦黑边；项目未使用完整 shadcn/ui 主题变量（按钮阴影用硬编码 rgba，不依赖 CSS 变量）

## 已知限制

- **KV 单值上限**: 5 MiB（5,242,880 B）— 代码层面已做检查
- **请求体限制**: 约 5 MB（边缘函数），代码设 5 MiB 安全线
- **KV 命名空间**: 全局变量 `TEXTDB`，不在 `context.env` 上
- **Edge Functions 不支持**: npm 包、Node.js 内置模块（fs/path/crypto）

## 构建与部署

```bash
npm run build        # 编译前端 + 生成 edge function
git push             # 自动部署到 EdgeOne Pages
```

`build-edge.cjs` 将 `dist/` 静态文件内联到 `functions/[[default]].js`，前端和 API 由同一个 edge function 提供服务。

## CSP（/p/ 路由）

```txt
default-src 'self'; script-src 'unsafe-inline' 'self'; object-src 'none';
style-src 'unsafe-inline' 'self'; img-src 'self' data: https:;
font-src 'self' https:; connect-src 'none'; form-action 'none';
base-uri 'self'; frame-ancestors 'self'
```

## 分支

- `feature/textdb-enhancements` — 当前活跃开发分支（文件夹上传、MdRenderer、CSP 修复）
- `master` — 稳定版本，与 feature/textdb-enhancements 已合并
