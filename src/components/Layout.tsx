import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export type NavItem = "operate" | "folder" | "api" | "changelog";

interface LayoutProps {
  activeNav: NavItem;
  onNavChange: (nav: NavItem) => void;
  children: ReactNode;
  totalKeys?: number;
  totalSize?: number;
  writesToday?: number;
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
