# TextDB EdgeOne

基于 EdgeOne Pages + KV 的在线文本数据库。匿名写入/读取，无用户系统。

## 架构

- **前端**: React 19 + Vite + Tailwind CSS + shadcn/ui
- **后端**: EdgeOne Edge Functions（V8 运行时）+ KV 存储（全局变量 `TEXTDB`）
- **部署**: GitHub 集成自动部署（push 即部署），不支持 CLI 部署

## 关键文件

| 文件 | 作用 |
|------|------|
| `build-edge.cjs` | 构建脚本 — Vite 构建产物内嵌到 edge function 源码 |
| `edge-functions/[[default]].js` | 构建产物（边缘函数源码），别直接编辑 |
| `src/App.tsx` | 前端主应用 |
| `src/api.ts` | API 调用封装 |
| `src/components/WriteCard.tsx` | 写入/上传组件 |
| `src/components/ReadCard.tsx` | 读取组件 |
| `index.html` | Vite 入口 HTML |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/update/` | 写入/更新/删除（JSON `{key, value}` 或 FormData） |
| `POST` | `/{key}` | 直接写入（请求体为内容） |
| `GET` | `/{key}` | 读取原始内容（`text/plain`） |
| `GET` | `/p/{key}` | HTML 渲染读取（含 CSP 安全头） |
| `DELETE` | `/{key}` | 删除 |
| `OPTIONS` | 任意 | CORS 预检 |

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

## 分支

- `feature/html-render` — `/p/{key}` HTML 渲染路由（未合入 master）
