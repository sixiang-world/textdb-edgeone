# 前端重构 & 样式重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 TextDB EdgeOne 前端从单栏 Tabs 布局迁移为紧凑图标侧边栏布局，全浅色 shadcn/ui 原生风格。

**Architecture:** 渐进式重构，4 个阶段：①布局骨架 ②组件打磨 ③页面提取 ④收尾打磨。不引入路由库，用 `useState` 管理导航状态。

**Tech Stack:** React 19 + TypeScript + Tailwind v4 + shadcn/ui + lucide-react + Geist Variable

---

## File Structure

```
src/
├── index.css                      # 引入 Geist 字体
├── App.tsx                        # 引入 Sidebar + MainLayout, 替换 Tabs
├── components/
│   ├── Sidebar.tsx                # [新] 紧凑图标侧边栏
│   ├── SidebarNavItem.tsx         # [新] 单个导航项（图标 + 悬停展开）
│   ├── Footer.tsx                 # [新] 页脚（StatsBar + BrandBar）
│   ├── Layout.tsx                 # [新] MainLayout（Toolbar + ContentArea + Footer）
│   ├── pages/
│   │   ├── OperatePage.tsx        # [新] 单文件操作页面（包裹 WriteCard）
│   │   ├── FolderPage.tsx         # [新] 文件夹上传页面（包裹 FolderUpload）
│   │   ├── ApiDocsPage.tsx        # [新] API 文档页面（包裹 ApiDocs）
│   │   └── ChangelogPage.tsx      # [新] 版本日志页面（包裹 Changelog）
│   ├── WriteCard.tsx              # 修改密码布局
│   ├── StatsCard.tsx              # 简化或删除
│   ├── FolderUpload.tsx           # 可选微调
│   └── ... (其他文件不变)
```

---

### Phase 1: Layout Skeleton（布局骨架）

### Task 1: Create Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/SidebarNavItem.tsx`

**Background:** 紧凑图标侧边栏，默认 56px 宽，右侧 `border-r` 分割。导航项默认仅显示图标，悬停时使用 Radix Tooltip 弹出文字标签。选中态使用 `bg-accent`（shadcn 原生浅灰）。

- [ ] **Step 1: Create SidebarNavItem.tsx**

单个导航项组件，接收 `icon`, `label`, `active`, `onClick` 四个 props。

```tsx
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarNavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: SidebarNavItemProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors",
            active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Icon className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Create Sidebar.tsx**

包含 logo、4 个导航项、底部统计圆圈。

```tsx
import { FileText, FolderUp, BookOpen, Rss } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";

type NavItem = "operate" | "folder" | "api" | "changelog";

interface SidebarProps {
  activeNav: NavItem;
  onNavChange: (nav: NavItem) => void;
  totalKeys?: number;
}

const NAV_ITEMS: { id: NavItem; icon: typeof FileText; label: string }[] = [
  { id: "operate", icon: FileText, label: "单文件操作" },
  { id: "folder", icon: FolderUp, label: "文件夹上传" },
  { id: "api", icon: BookOpen, label: "API 文档" },
  { id: "changelog", icon: Rss, label: "版本日志" },
];

export function Sidebar({ activeNav, onNavChange, totalKeys }: SidebarProps) {
  return (
    <aside className="flex w-14 flex-col items-center gap-1 border-r bg-muted/30 py-3">
      {/* Logo */}
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
        T
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeNav === item.id}
            onClick={() => onNavChange(item.id)}
          />
        ))}
      </nav>

      <div className="mt-auto">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground">
          {totalKeys ?? "—"}
        </div>
      </div>
    </aside>
  );
}
```

Note: The `Tooltip` component requires wrapping in `TooltipProvider`. We'll add that at `App.tsx` level in Task 3.

- [ ] **Step 3: Check if Tooltip component exists**

Radix Tooltip may not have a shadcn wrapper yet. Check `src/components/ui/tooltip.tsx`:

Run: `ls src/components/ui/tooltip.tsx 2>/dev/null && echo "exists" || echo "missing"`
Expected: "missing" — we need to create it or use a simpler CSS hover approach.

If missing, the simplest path is to use a CSS-only approach: add a `group` class and show a hover label via `group-hover` since we don't want to add shadcn blocks for a single use case:

```tsx
// Alternative: CSS-only hover tooltip in SidebarNavItem
<button
  onClick={onClick}
  className={cn(
    "group relative flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors",
    active
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  )}
>
  <Icon className="size-5" />
  {/* CSS hover label — shows to the right of the icon */}
  <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm group-hover:block">
    {label}
  </span>
</button>
```

Create `src/components/ui/tooltip.tsx` using Radix Tooltip if shadcn wrapper is available. Otherwise use the CSS approach above.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/SidebarNavItem.tsx
git commit -m "feat: add Sidebar and SidebarNavItem components"
```

---

### Task 2: Create Footer component

**Files:**
- Create: `src/components/Footer.tsx`

**Background:** 页脚包含两行：上为统计行（总 Key 数 | 总存储 | 今日写入），下为品牌链接行。

- [ ] **Step 1: Create Footer.tsx**

```tsx
import { ExternalLink } from "lucide-react";
import { Hash, HardDrive, PencilLine } from "lucide-react";

interface FooterProps {
  totalKeys?: number;
  totalSize?: string;
  writesToday?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function Footer({ totalKeys, totalSize, writesToday }: FooterProps) {
  return (
    <footer className="border-t px-5 py-2.5">
      {/* Stats row */}
      {totalKeys !== undefined && (
        <div className="mb-2 flex items-center gap-5 border-b pb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Hash className="size-3.5" />
            总 Key 数 <strong className="text-foreground tabular-nums">{totalKeys}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-3.5" />
            总存储 <strong className="text-foreground tabular-nums">{totalSize ? formatSize(Number(totalSize)) : "—"}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <PencilLine className="size-3.5" />
            今日写入 <strong className="text-foreground tabular-nums">{writesToday ?? "—"}</strong>
          </span>
        </div>
      )}

      {/* Brand row */}
      <div className="flex items-center justify-center gap-3 text-xs">
        <span className="font-semibold tracking-tight">TextDB EdgeOne</span>
        <span className="text-muted-foreground/40">·</span>
        <a
          href="https://pages.edgeone.ai"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          target="_blank"
          rel="noreferrer"
        >
          <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-wide">
            EdgeOne
          </span>
          Pages
          <ExternalLink className="size-3" />
        </a>
        <a
          href="https://github.com/sixiang-world/textdb-edgeone"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          target="_blank"
          rel="noreferrer"
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
          <ExternalLink className="size-3" />
        </a>
      </div>
    </footer>
  );
}
```

Note: `totalSize` prop accepts a number (bytes) since the API returns `Stats.totalSize` as a number. The `formatSize` function is extracted inline into the component.

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat: add Footer component with stats bar and brand links"
```

---

### Task 3: Refactor App.tsx — layout skeleton

**Files:**
- Create: `src/components/Layout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/StatsCard.tsx` (simplify—stats now only in Footer)

**Background:** 主布局组件，包含 Sidebar + Toolbar + ContentArea + Footer。App.tsx 使用 Layout 替换原有 Tabs 结构。统计逻辑从 StatsCard 提取进 Footer，StatsCard 可移除。

- [ ] **Step 1: Create Layout.tsx**

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export type NavItem = "operate" | "folder" | "api" | "changelog";

interface LayoutProps {
  activeNav: NavItem;
  onNavChange: (nav: NavItem) => void;
  children: ReactNode;
  totalKeys?: number;
  totalSize?: string;
  writesToday?: number;
  /** Toolbar breadcrumb labels */
  title?: string;
  subtitle?: string;
}

const NAV_TITLES: Record<NavItem, { title: string; subtitle: string }> = {
  operate: { title: "单文件操作", subtitle: "写入内容到 KV 存储" },
  folder: { title: "文件夹上传", subtitle: "批量上传文件到 KV" },
  api: { title: "API 文档", subtitle: "RESTful API 参考" },
  changelog: { title: "版本日志", subtitle: "更新历史" },
};

export function Layout({
  activeNav,
  onNavChange,
  children,
  totalKeys,
  totalSize,
  writesToday,
}: LayoutProps) {
  const navMeta = NAV_TITLES[activeNav];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeNav={activeNav}
        onNavChange={onNavChange}
        totalKeys={totalKeys}
      />
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b bg-muted/20 px-5 py-2 text-sm">
          <span className="font-medium text-foreground">{navMeta.title}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground">{navMeta.subtitle}</span>
        </div>

        {/* Content */}
        <main className="flex-1 px-5 py-5">
          {children}
        </main>

        {/* Footer */}
        <Footer
          totalKeys={totalKeys}
          totalSize={totalSize}
          writesToday={writesToday}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx — replace Tabs with Layout**

```tsx
import { useState, useEffect } from "react";
import { WriteCard } from "@/components/WriteCard";
import { ApiDocs } from "@/components/ApiDocs";
import { Changelog } from "@/components/Changelog";
import { FolderUpload } from "@/components/FolderUpload";
import { MdRenderer } from "@/components/MdRenderer";
import { Toaster } from "@/components/ui/sonner";
import { Layout, type NavItem } from "@/components/Layout";
import { getStats, type Stats } from "@/api";

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("operate");
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStats(controller.signal).then(setStats).catch(() => {});
    return () => controller.abort();
  }, [statsRefreshTrigger]);

  function onStatsRefresh() {
    setStatsRefreshTrigger((n) => n + 1);
  }

  // /md/{key} 路由 — SPA 自行解析
  if (window.location.pathname.startsWith("/md/")) {
    return (
      <>
        <MdRenderer />
        <Toaster />
      </>
    );
  }

  const renderContent = () => {
    switch (activeNav) {
      case "operate":
        return <WriteCard onStatsRefresh={onStatsRefresh} />;
      case "folder":
        return <FolderUpload onStatsRefresh={onStatsRefresh} />;
      case "api":
        return <ApiDocs />;
      case "changelog":
        return <Changelog />;
    }
  };

  return (
    <Layout
      activeNav={activeNav}
      onNavChange={setActiveNav}
      totalKeys={stats?.totalKeys}
      totalSize={stats?.totalSize}
      writesToday={stats?.writesToday}
    >
      {renderContent()}
      <Toaster />
    </Layout>
  );
}
```

注意：Layout 内部已经有 Sidebar + Footer，因此 `Toaster` 放在 Layout children 尾部（全局单一实例）。原来的 header/footer 全部由 Layout/Footer 替代。

- [ ] **Step 3: Clean up StatsCard.tsx**

StatsCard 不再需要独立渲染在 App 中（统计逻辑已移至 Footer）。保留文件作为被引用的备用，在文件顶部添加 `@deprecated` 注释，或将导出改为空的桩组件。

Option A（推荐 — 无引用即可删除）：检查无其他 import 后直接删除文件。

Option B（保守）：保留文件但导出空桩：

```tsx
// @deprecated — 统计已移至 Footer 组件。此文件仅用于向后兼容。
export function StatsCard(_props: { refreshTrigger?: number }) {
  return null;
}
```

检查引用：
Run: `grep -r "StatsCard" src/ --include="*.tsx" --include="*.ts" | grep -v "StatsCard.tsx"`
Expected: 不再被引用（因为 App.tsx 已移除 StatsCard 引用）

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: 构建成功，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/App.tsx
# 如果删除 StatsCard:
git rm src/components/StatsCard.tsx
git commit -m "feat: replace Tabs layout with Sidebar + Layout skeleton"
```

---

### Phase 2: Component Polish（组件打磨）

### Task 4: Refactor WriteCard — 密码移到上传按钮右侧

**Files:**
- Modify: `src/components/WriteCard.tsx`

**Background:** 密码从操作按钮行移出，移到上传文本文件按钮的右侧，带展开/收缩新密码区域功能。

- [ ] **Step 1: Update WriteCard — 移动密码区域到上传按钮右侧**

修改 JSX 中密码相关部分：

将原来的纯上传按钮区域（约行 321-335）和密码区域（约行 350-414）合并替换为：

```tsx
{/* Upload + Password row */}
<div className="flex flex-wrap items-center gap-2">
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

  {/* Password input */}
  <div className="flex items-center gap-1.5">
    <div className="flex items-center">
      <Input
        type={showPassword ? "text" : "password"}
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="font-mono h-8 w-24 sm:w-[110px] rounded-r-none"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
        type="button"
        className="h-8 w-8 rounded-l-none border-l-0"
      >
        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </Button>
    </div>

    {/* Expand button — only visible when password has content */}
    {password && (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => { setShowPwdOptions(!showPwdOptions); if (!showPwdOptions) setNewPasswordTouched(false); }}
        type="button"
        className="h-8 w-8"
      >
        <ChevronRight className={cn("size-4 transition-transform", showPwdOptions && "rotate-90")} />
      </Button>
    )}
  </div>

  {/* Expanded: new password + remove */}
  {password && showPwdOptions && (
    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1">
      <Input
        type="password"
        placeholder="新密码"
        value={newPassword}
        onChange={(e) => { setNewPassword(e.target.value); setNewPasswordTouched(true); }}
        className="font-mono h-8 w-24 sm:w-[110px]"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setRemovePassword(true); setShowPwdOptions(false); }}
        className="h-8 text-xs whitespace-nowrap text-destructive border-destructive/30 hover:bg-destructive/10"
        type="button"
      >
        移除密码
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setShowPwdOptions(false); setNewPasswordTouched(false); }}
        className="h-8 text-xs text-muted-foreground"
        type="button"
      >
        ✕ 取消
      </Button>
    </div>
  )}
</div>

{/* Hint text below */}
<p className="text-xs text-muted-foreground">
  支持 HTML/CSS/JS/MD 等文本文件，可在文件对话框切换"所有文件"
</p>
```

需要新增的 import：
```tsx
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
```

注意：需要确保 `ChevronRight` 在 lucide import 中，并添加 `cn` import。

- [ ] **Step 2: 从操作按钮行移除密码相关代码**

确保原来操作按钮行（包含 写入/读取/删除 按钮的那一段）中的密码控件组完全移除。删除以 `{/* 右侧密码控件组 */}` 注释开始的整个 div 块。

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add src/components/WriteCard.tsx
git commit -m "refactor: move password input to upload button row with expand/collapse"
```

---

### Phase 3: Page Extraction（页面提取）

### Task 5: Extract page wrapper components

**Files:**
- Create: `src/components/pages/OperatePage.tsx`
- Create: `src/components/pages/FolderPage.tsx`
- Create: `src/components/pages/ApiDocsPage.tsx`
- Create: `src/components/pages/ChangelogPage.tsx`
- Modify: `src/App.tsx`

**Background:** 为每个导航项创建专用 Page wrapper 组件，使 App.tsx 的导航逻辑更清晰，也为未来每页的独立逻辑（如单独的数据加载、错误处理）预留空间。

- [ ] **Step 1: Create OperatePage.tsx**

```tsx
import { WriteCard } from "@/components/WriteCard";

interface OperatePageProps {
  onStatsRefresh?: () => void;
}

export function OperatePage({ onStatsRefresh }: OperatePageProps) {
  return <WriteCard onStatsRefresh={onStatsRefresh} />;
}
```

- [ ] **Step 2: Create FolderPage.tsx**

```tsx
import { FolderUpload } from "@/components/FolderUpload";

interface FolderPageProps {
  onStatsRefresh?: () => void;
}

export function FolderPage({ onStatsRefresh }: FolderPageProps) {
  return <FolderUpload onStatsRefresh={onStatsRefresh} />;
}
```

- [ ] **Step 3: Create ApiDocsPage.tsx**

```tsx
import { ApiDocs } from "@/components/ApiDocs";

export function ApiDocsPage() {
  return <ApiDocs />;
}
```

- [ ] **Step 4: Create ChangelogPage.tsx**

```tsx
import { Changelog } from "@/components/Changelog";

export function ChangelogPage() {
  return <Changelog />;
}
```

- [ ] **Step 5: Update App.tsx — use page components**

将 `renderContent` 中的 JSX 调用替换为 Page 组件：

```tsx
import { OperatePage } from "@/components/pages/OperatePage";
import { FolderPage } from "@/components/pages/FolderPage";
import { ApiDocsPage } from "@/components/pages/ApiDocsPage";
import { ChangelogPage } from "@/components/pages/ChangelogPage";

// 在 renderContent 中：
const renderContent = () => {
  switch (activeNav) {
    case "operate":
      return <OperatePage onStatsRefresh={onStatsRefresh} />;
    case "folder":
      return <FolderPage onStatsRefresh={onStatsRefresh} />;
    case "api":
      return <ApiDocsPage />;
    case "changelog":
      return <ChangelogPage />;
  }
};
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 7: Commit**

```bash
git add src/components/pages/ src/App.tsx
git commit -m "refactor: extract page components for each nav item"
```

---

### Phase 4: Polish & Edge Cases

### Task 6: Geist font + responsive polish

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/Sidebar.tsx` (hover animation)

- [ ] **Step 1: Update index.css — 引入 Geist 字体**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "@fontsource-variable/geist";

@theme inline {
  --color-ring: oklch(0.708 0 0);
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
}
```

然后在 `src/index.css` 中更新 `@theme` 添加 `--font-sans`。

- [ ] **Step 2: Update Sidebar — smooth transitions**

在 `src/components/Sidebar.tsx` 的 nav item 上添加 `transition-colors duration-150`（已在 SidebarNavItem 的 cn() 中包含了 transition-colors）。

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/Sidebar.tsx
git commit -m "style: add Geist font and smooth transitions"
```

---

### Task 7: Final visual review

**Files:**
- Review: all modified files

- [ ] **Step 1: Run dev server and visually verify**

Run: `npm run dev`
Expected: 开发服务器启动。

- [ ] **Step 2: Manual check checklist**

- [ ] 侧边栏 4 个导航项渲染正常
- [ ] 选中项有浅灰 `bg-accent` 背景
- [ ] 悬停时显示文字标签
- [ ] 导航切换正确渲染对应页面
- [ ] 页脚显示统计数据和品牌链接
- [ ] WriteCard 密码在"上传文本文件"右侧
- [ ] 密码输入后 ▶ 展开可输入新密码和移除
- [ ] `/md/{key}` 路由仍然正常工作
- [ ] 无控制台错误

- [ ] **Step 3: Commit any final fixes**

```bash
git commit -am "style: final visual polish"
```
