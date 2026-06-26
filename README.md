# TextDB EdgeOne

基于 EdgeOne Pages + KV 的在线文本数据库。匿名写入/读取，无用户系统。

## 架构

- **前端**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui
- **后端**: EdgeOne Edge Functions（V8 运行时）+ KV 存储
- **部署**: GitHub 集成自动部署（push 即部署）

## 开发

### CNB 云原生开发（推荐）

点击 CNB 仓库页面上的「云原生开发」按钮即可启动在线开发环境。首次启动会自动执行 `npm install` 并验证 typecheck + lint。

环境通过 `.ide/Dockerfile`（基于 [CNB 默认开发环境](https://cnb.cool/cnb/cool/default-dev-env)）+ `.ide/settings.json`（编辑器配置）预配置，开箱即用：formatOnSave、Prettier 默认格式化、Tailwind CSS IntelliSense、ESLint 自动修复等。支持 WebIDE、VSCode、Cursor、CodeBuddy 等客户端连接。

### 本地开发

```bash
npm install
npm run dev          # Vite 本地开发
npm run build        # 编译前端 + 生成 edge function
git push             # 自动部署到 EdgeOne Pages
```

`build-edge.cjs` 将 `dist/` 静态文件内联到 `edge-functions/[[default]].js`，前端和 API 由同一个 edge function 提供服务。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/update/` | 写入/更新/删除（JSON `{key, value}` 或 FormData） |
| `POST` | `/{key}` | 直接写入（请求体为内容） |
| `GET` | `/{key}` | 读取原始内容（`text/plain`） |
| `GET` | `/p/{key}` | HTML 渲染（含 CSP 安全头） |
| `GET` | `/md/{key}` | Markdown 渲染（前端 SPA） |
| `GET` | `/file/{ext}/{key}` | 按扩展名输出（自动 Content-Type，不支持 html/svg，含 nosniff） |
| `GET` | `/stats` | 统计信息（总 Key 数、总存储量、今日写入次数） |
| `DELETE` | `/{key}` | 删除 |

## 功能

- **文本读写** — 匿名 Key-Value 存储，支持随机 Key 生成
- **统计面板** — 页面底部实时展示总 Key 数、总存储量、今日写入次数
- **QR 码** — 写入/读取成功后自动生成当前链接的二维码，支持下载
- **文件夹上传** — `webkitdirectory` 选择文件夹，自动前缀、HTML 引用改写、进度条
- **HTML 渲染** — `/p/{key}` 带 CSP 安全头渲染上传的 HTML 页面
- **Markdown 渲染** — `/md/{key}` 前端 Markdown 渲染，支持 GFM
- **文件路由** — `/file/{ext}/{key}` 按扩展名设置 Content-Type（JS/CSS/JSON 等，html/svg 已拒绝，含 nosniff 安全头）

## 已知限制

- KV 单值上限 5 MiB
- Edge Functions 不支持 npm 包、Node.js 内置模块
- `/p/` 路由的 CSP 允许 `unsafe-inline` 脚本（设计取舍）
- `/stats` 通过 `TEXTDB.list()` 遍历统计，Key 数量较多时响应较慢（最多扫描 5000 个）
- `/stats` 通过 `TEXTDB.list()` 遍历统计，Key 数量较多时响应较慢（最多扫描 5000 个）

## License

MIT
