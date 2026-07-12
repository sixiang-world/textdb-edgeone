import { FileText, FolderUp, BookOpen, Rss } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";

export type NavItem = "operate" | "folder" | "api" | "changelog";

export interface SidebarProps {
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
