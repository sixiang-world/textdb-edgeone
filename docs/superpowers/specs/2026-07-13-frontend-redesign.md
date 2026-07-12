# TextDB EdgeOne 前端重构 & 样式重设计

> 基于 shadcn/ui 原生组件，采用紧凑图标侧边栏布局 + Vercel 风格极简美学，渐进式重构现有前端。

## Background

TextDB EdgeOne 当前前端采用 Tabs（标签页）布局，所有功能集中在三个 Tab 下（操作 / API 文档 / 版本日志），缺乏全局导航骨架。随着功能增加（密码保护、文件夹上传、二维码等），页面内容密度升高，布局局限逐渐显现：

- 单栏窄布局（max-w-3xl ≈ 768px）限制信息展示
- 无侧边栏导航，所有功能平铺在 Tab 下
- 统计信息（StatsCard）位置尴尬，视觉上像是附加内容
- 密码输入混在操作按钮行，与主要操作争夺空间
- 视觉风格偏向基础，缺少现代感

## Design Goals

1. **清晰的导航结构** — 紧凑图标侧边栏，悬停展开文字，四个导航项
2. **shadcn/ui 原生贴合** — 不引入额外设计 token，充分利用现有组件库
3. **信息层级优化** — 统计下沉到页脚，密码独立区域，操作按钮更聚焦
4. **渐进式迁移** — 保持现有功能逻辑不变，逐步替换布局层
5. **为未来扩展留空间** — 侧边栏可增删导航项，内容区动态路由

## Layout Architecture

```
┌────────────┬─────────────────────────────────────────────┐
│            │  Toolbar (面包屑导航)                        │
│  Sidebar   ├─────────────────────────────────────────────┤
│  (56px)    │                                             │
│            │  Content Area                               │
│  图标      │  ┌───────────────────────────────────────┐  │
│  点击      │  │  组件卡片根据导航项动态渲染            │  │
│  选中      │  │  - 单文件操作（WriteCard）             │  │
│  悬停      │  │  - 文件夹上传（FolderUpload）          │  │
│  展开      │  │  - API 文档                            │  │
│  文字      │  │  - 版本日志                            │  │
│            │  └───────────────────────────────────────┘  │
│            ├─────────────────────────────────────────────┤
│            │  Footer                                     │
│            │  统计行: 总 Key 数 | 总存储 | 今日写入      │
│            │  品牌行: TextDB EdgeOne · EdgeOne · GitHub  │
└────────────┴─────────────────────────────────────────────┘
```

### Sidebar（侧边栏）

- 宽度：56px（默认图标态）
- 背景：`bg-muted/30`（浅灰，`#f8fafc`）
- 右边框：`border-r` 分割
- 导航项：纯图标，宽度 40px，高度 40px
- 选中态：`bg-accent`（`#f4f4f5`）+ `text-accent-foreground`
- 悬停展开：`group-hover` 触发，图标右侧弹出文字标签（Tooltip 或 Popover）
- 底部：Logo（圆形深色徽标）+ 简要统计数字

### Toolbar（工具栏）

- 高度：约 40px
- 背景：`bg-muted/20`（比内容区略微深一点）
- 内容：面包屑导航（当前页面名称 + 子标题描述）

### Content Area（内容区）

- 背景：`bg-background`（纯白）
- 内边距：`p-5`（20px）
- 按导航项渲染对应页面组件
- 统计信息仅在页脚显示，内容区不出现

### Footer（页脚）

- 上边框：`border-t`
- 内边距：`py-2.5 px-5`
- **统计行**：`border-b` 分隔，紧凑布局显示三个指标（总 Key 数、总存储、今日写入），使用 `text-xs` + `tabular-nums`
- **品牌行**：TextDB EdgeOne + EdgeOne Pages 徽章 + GitHub 链接

## Component Tree

```
App
├── Sidebar
│   ├── Logo
│   ├── NavItem (×4)        # 图标 + 悬停展开文字
│   │   ├── 单文件操作
│   │   ├── 文件夹上传
│   │   ├── API 文档
│   │   └── 版本日志
│   └── SidebarStats        # 侧栏底部简要统计
├── MainLayout
│   ├── Toolbar              # 面包屑导航
│   ├── ContentArea          # 动态页面渲染
│   │   ├── OperatePage      # 单文件操作
│   │   ├── FolderPage       # 文件夹上传
│   │   ├── ApiDocsPage      # API 文档
│   │   └── ChangelogPage    # 版本日志
│   └── Footer
│       ├── StatsBar         # 统计行（从 StatsCard 提取）
│       └── BrandBar         # 品牌链接行
└── Toaster
```

## Navigation & Routing

### 状态管理

使用 React `useState` 管理当前激活的导航项，无需引入路由库：

```tsx
type NavItem = "operate" | "folder" | "api" | "changelog";
const [activeNav, setActiveNav] = useState<NavItem>("operate");
```

### URL 同步（可选增强）

- `setActiveNav` 时通过 `history.replaceState` 同步 URL hash（如 `#operate`、`#api`）
- 页面加载时从 URL hash 恢复导航状态
- 注意：`/md/{key}` 渲染路径保持独立不受影响

### MdRenderer 路由

- `/md/{key}` 渲染路径保持独立：若 `window.location.pathname.startsWith("/md/")`，跳过 MainLayout 直接渲染 `MdRenderer` + `Toaster`
- 此逻辑在 `App.tsx` 顶层判断

## Styling Approach

### 主题

- 仅使用 shadcn/ui 提供的 CSS 变量（Tailwind v4 `@theme`）
- 不额外定义 `--color-border`（保留当前有意注释的状态）
- 按钮的 3D 阴影效果（`shadow-[0_3px_0_...]`）保留，属于 shadcn 风格组件的一部分

### 字体

- 已安装 `@fontsource-variable/geist`（Vercel 字体）
- 在 `index.css` 中引入 Geist Variable 字体作为全局无衬线字体

### 组件库

- 卡片：shadcn `Card` 组件，原生 `rounded-xl` + `ring-1 ring-foreground/10`
- 按钮：shadcn `Button`，原生 variant（`default` / `outline` / `ghost` / `destructive` / `link`）
- 输入框：shadcn `Input`，原生 `rounded-lg` + `border-input`
- 文本区：shadcn `Textarea`
- 所有 UI 交互保持 shadcn 默认样式

## Specific Layout Decisions

### 密码位置

密码从操作按钮行移出，放到卡片内上传按钮同行的右侧：

```
[📄 上传文本文件]  [🔒 密码 ____]  [▶]
                                       ← 展开后
[📄 上传文本文件]  [🔒 ••••••]  [▼]  [新密码 ____]  [移除密码]
```

- 默认态：仅显示密码输入框 + 展开箭头
- 展开态：显示新密码输入框 + 移除密码按钮
- 密码可见性切换通过 👁 图标控制

### 统计位置

- StatsCard 组件保持不变，但仅渲染在 Footer 的 StatsBar 中
- 内容区不再出现统计信息
- StatsBar 使用紧凑内联布局，三个指标一行显示

### 上传文本文件

- 保留现有 `input[type=file]` 样式
- 与密码输入同行的视觉对齐

## Responsive Considerations

- 侧边栏在小屏幕上可考虑切换为底部导航栏（TabBar 风格）
- 或保持侧边栏但支持手势滑动展开
- 首次实现以桌面为主，移动端后续优化
- 内容区保持 `max-w-3xl` 或 `max-w-4xl` 限制最大宽度以保证可读性

## Migration Strategy

分四阶段实施：

### Phase 1: Layout Skeleton（布局骨架）

- 创建 `Sidebar` 组件
- 修改 `App.tsx`，引入侧边栏 + 内容区布局
- 将现有 Tabs 切换改为侧边栏导航切换
- 统计信息从独立 `StatsCard` 提取到 Footer
- 此阶段结束时：布局骨架可运行，功能完全不变

### Phase 2: Component Polish（组件打磨）

- 调整 `WriteCard` 中密码位置
- 优化按钮间距和卡片内边距
- 引入 Geist 字体
- 微调 shadcn 组件默认样式一致性

### Phase 3: Page Extraction（页面提取）

- 将各 Tab 内容提取为独立页面组件
- 为每个导航项创建专用 Page wrapper
- 清理冗余状态管理

### Phase 4: Polish & Edge Cases（打磨收尾）

- 动画过渡（导航切换、侧边栏展开、密码区域展开）
- 移动端适配基础
- URL hash 同步
- 无障碍（aria 标签、键盘导航）

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | 引入 Geist 字体，更新 `@theme` 配置 |
| `src/App.tsx` | 引入 Sidebar + Layout，替换 Tabs |
| `src/components/Sidebar.tsx` | **新文件** — 紧凑图标侧边栏 |
| `src/components/SidebarNavItem.tsx` | **新文件** — 单个导航项，含悬停展开逻辑 |
| `src/components/Footer.tsx` | **新文件** — 页脚（StatsBar + BrandBar） |
| `src/components/WriteCard.tsx` | 调整密码布局 |
| `src/components/StatsCard.tsx` | 简化，仅在 Footer 中使用或移除独立组件 |
| `src/components/FolderUpload.tsx` | 可选调整 |
| `src/components/ApiDocs.tsx` | 包装为独立页面组件 |
| `src/components/Changelog.tsx` | 包装为独立页面组件 |
