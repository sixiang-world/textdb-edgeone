import { ExternalLink, Hash, HardDrive, PencilLine } from "lucide-react";
import { formatSize } from "@/lib/utils";

interface FooterProps {
  totalKeys?: number;
  totalSize?: number;
  writesToday?: number;
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
            总存储 <strong className="text-foreground tabular-nums">{totalSize != null ? formatSize(totalSize) : "—"}</strong>
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
