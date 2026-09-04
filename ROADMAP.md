# TextDB EdgeOne — 开发路线图

> 最后更新：2026-09-04
> 本文档记录所有讨论过的开发方向，按"当前版本做 / 后续版本做 / 暂不考虑"三类划分。
> Code Review 遗留的技术债见 `REVIEW_TODO.md`。

---

## 当前版本（v1.3.0）— ✅ 已发布（2026-09-04）

### 1. 本地 Key 浏览（localStorage）
- **目标**：解决"写了之后找不到 key"的问题
- **方案**：前端在写入成功后，把 key 记录到浏览器 localStorage（`textdb-keys`），提供一个浏览面板展示当前浏览器写入过的 key 列表，支持点击快速读取/删除
- **范围**：纯前端，不涉及服务端改动
- **注意**：仅记录当前浏览器写入的 key，不提供全量 key 列表（匿名场景下列出所有 key 有隐私风险）

### 2. 写入队列 / 重试（IndexedDB 暂存）
- **目标**：弱网环境下写入失败不丢数据
- **方案**：写入请求先入 IndexedDB 队列，成功则出队；失败则保留并自动重试（指数退避，最多 N 次）。页面重新打开时自动恢复未完成的队列
- **范围**：纯前端，`src/api.ts` 封装一层队列 + `WriteCard`/`FolderUpload` 接入
- **注意**：队列状态需在 UI 上可见（ pending / 成功 / 失败 ），失败允许手动重发或丢弃

### 3. Markdown 增强
- **目标**：`/md/{key}` 渲染从基础 Markdown 升级为完整文档体验
- **方案**：基于 `react-markdown` 生态插件
  - 代码语法高亮（`rehype-highlight` / `shiki`）
  - 目录生成（`rehype-slug` + `rehype-autolink-headings`，侧栏 TOC）
  - Mermaid 图表（`remark-mermaid`）
  - 数学公式（`remark-math` + `rehype-katex`）
- **范围**：`src/components/MdRenderer.tsx` 及相关样式
- **注意**：插件体积需评估，Mermaid/KaTeX 较大，考虑按需加载或动态 import

### 4. OpenAPI / Swagger 文档
- **目标**：用标准 OpenAPI 3.0 spec 替代当前手写的 `ApiDocs.tsx`
- **方案**：
  - 编写 `openapi.json`（或 `openapi.yaml`）描述全部端点
  - 前端用 `swagger-ui-react` 或 `redoc` 渲染，或保留自定义 UI 但数据来源改为 spec
  - spec 可被外部工具直接导入（Postman / Insomnia / 代码生成）
- **范围**：新增 spec 文件 + `ApiDocs` 组件改造
- **注意**：需覆盖全部端点（`/update/`、`/{key}` GET/POST/DELETE、`/p/{key}`、`/file/{ext}/{key}`、`/md/{key}`、`/stats`、OPTIONS），含密码参数说明

---

## 后续版本候选 — 这个版本暂时不做

### 5. 版本历史
- 每次写入保留最近 N 个版本（`key.v1`, `key.v2` ...），支持查看历史和回滚
- 代价：KV 存储量翻倍，需设计版本上限和清理策略

### 6. 端到端加密（E2EE）
- 前端用 WebCrypto（AES-GCM）加密 value 后再上传，密钥由用户密码通过 PBKDF2 派生，不出浏览器
- 服务端无法读取明文内容；渲染管道需前端解密后再渲染
- 与 `REVIEW_TODO.md` 中"密码哈希升级 PBKDF2"自然衔接
- 注意：忘记密码 = 数据永久丢失，需明确 UX 提示

### 7. KV 热点分片
- 单 value 接近 5MiB 上限时自动分片为 `key.part1/2/3`，读取时合并
- 解决大文件（长 HTML、大 JSON）的存储限制

### 8. 结构化数据查询
- 支持 JSON value 的子集读取：`/json/{key}?path=data.user.name`
- KV 存原始 JSON，读时 Edge Function 解析后返回子路径
- 轻量增量，不改变存储模型

### 9. Webhook
- 某个 key 写入/删除时，自动向用户配置的 URL 发送 HTTP POST 通知
- 设计要点（已讨论）：
  - per-key 配置（`{key}.webhook`），设密码的 key 配置 webhook 需密码
  - 仅写入成功后触发（删除触发后续再加）
  - Payload 只发 `{key, action, timestamp}`，不发完整 value（接收方自行 GET）
  - HMAC-SHA256 签名，接收方可验证来源
  - SSRF 防护：拦截内网 IP（10.x / 172.16-31 / 192.168 / 127.x / 169.254）
  - 异步触发，失败不影响写入响应，最多重试 2 次
  - 每 key 速率限制，防止滥用
- 典型场景：简易表单后端（飞书/钉钉通知）、配置变更通知、静态站更新触发 deploy hook、内容审核、数据备份同步、n8n/Make 自动化触发器

---

## 暂不考虑 — 明确不实现

### 10. TTL 过期
- 写入时可选 `expire_at`，读时校验过期自动删除
- 暂不考虑原因：KV 无原生 TTL，需外层包元数据，增加读写路径复杂度；当前匿名场景需求不明确

### 11. 官方 SDK / CLI
- npm SDK（`@textdb/sdk`）、命令行工具（`textdb push/pull`）
- 暂不考虑原因：当前用户量不足以支撑 SDK 维护成本；API 足够简单，手写 fetch/curl 即可

### 12. EdgeOne CDN 层缓存
- 在 Edge Function 响应上加 `Cache-Control`，让 CDN 节点直接缓存读响应
- 暂不考虑原因：KV 自带 60 秒边缘缓存，当前访问速度已足够；CDN 缓存需处理失效问题（purge 或短 TTL），增加复杂度

### 13. 产品化（用户系统 / 配额 / 自定义域名）
- OAuth 登录、per-user 隔离、配额管理、自定义域名绑定
- 暂不考虑原因：与"极简匿名"定位冲突；EdgeOne 无原生用户数据库，实现成本高

### 14. AI 摘要 / 翻译
- 读取长文本时调用 LLM 生成摘要或翻译
- 暂不考虑原因：依赖外部 API 和成本，匿名场景下计费/限流复杂

---

## 版本记录

| 版本 | 日期 | 主要内容 |
|---|---|---|
| v1.2.0 | 2026-07-13 | 前端重构（Sidebar 布局）、密码保护、AI 爬虫识别、Geist 字体 |
| v1.3.0 | 2026-09-04 | 本地 key 浏览、写入队列/重试、Markdown 增强（代码高亮/公式/Mermaid/TOC）、OpenAPI 文档 |
