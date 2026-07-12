import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors duration-150",
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
  );
}
