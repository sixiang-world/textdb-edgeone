# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-09-04

### Added

- **OpenAPI 文档**：新增 `/api` 页面，基于 swagger-ui 展示完整 API 规范（8 个端点、4 个 Schema），支持在线调试
- **本地 Key 历史浏览**：操作页底部新增可折叠的历史 Key 列表，基于 localStorage 记录最近 200 条写入过的 Key 元数据，支持搜索和一键选择
- **写入队列 / 自动重试**：所有写入、删除、上传操作改为通过 IndexedDB 队列串行执行，网络失败时指数退避自动重试 3 次，网络恢复后自动继续，右下角浮动队列状态指示器
- **Markdown 增强**：
  - 数学公式渲染（KaTeX，行内 `$...$` 和块级 `$$...$$`）
  - 代码语法高亮（rehype-highlight，atom-one-dark 主题）
  - 标题自动锚点 + 点击复制链接
  - Mermaid 图表渲染（securityLevel: strict）
  - 右侧 TOC 目录导航（自动提取 h1-h4，滚动高亮）

### Fixed

- FolderUpload 上传进度状态在入队后立即重置，导致进度条一闪即逝且按钮可重复点击
- WriteCard 写入/删除按钮改为队列后未禁用，可重复点击导致重复入队
- WriteCard 写入成功后密码字段未清除，存在肩窥风险
- WriteCard 队列操作失败时缺少 onError 回调，本地 UI 无反馈
- writeQueue enqueue 中 IndexedDB 写入未 await，失败时静默丢失
- writeQueue online 事件监听器在 StrictMode 下重复注册
- Mermaid 初始化未设置 securityLevel，存在 XSS 风险
- QueueStatus 重试次数上限硬编码，改为从 writeQueue 导入 MAX_RETRIES
- App.tsx 历史刷新事件名硬编码，改为导入 HISTORY_REFRESH_EVENT 常量
- ApiDocs fetch 未处理组件卸载，添加 AbortController

### Changed

- package.json 版本号 1.2.0 → 1.3.0

## [1.2.0] - 2026-08-??

### Added

- 文件夹批量上传功能
- 密码保护（写入/更新/删除时验证）
- HTML/JS 内容自动识别和专属链接
- 二维码生成
- 统计面板（总 Key 数、总大小、今日写入数）

### Changed

- 重构为 React + Vite + TypeScript
- 部署至 EdgeOne Pages + KV
