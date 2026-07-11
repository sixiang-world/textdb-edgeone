import { useEffect, useState } from "react";
import { getStats, type Stats } from "@/api";
import { Hash, HardDrive, PencilLine, Loader2 } from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StatsCard({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const s = await getStats(controller.signal);
        setStats(s);
      } catch (e: unknown) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshTrigger]);

  return (
    <div className="rounded-xl border bg-card py-4 shadow-xs">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            加载统计...
          </span>
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground text-center py-1">
          统计加载失败
        </p>
      ) : stats ? (
        <div className="flex items-center justify-center gap-8 sm:gap-12">
          <StatItem
            icon={<Hash className="size-4" />}
            label="总 Key 数"
            value={String(stats.totalKeys) + (!stats.scannedAll ? "+" : "")}
          />
          <div className="h-8 w-px bg-border" />
          <StatItem
            icon={<HardDrive className="size-4" />}
            label="总存储量"
            value={formatSize(stats.totalSize) + (!stats.scannedAll ? "+" : "")}
          />
          <div className="h-8 w-px bg-border" />
          <StatItem
            icon={<PencilLine className="size-4" />}
            label="今日写入"
            value={String(stats.writesToday)}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground leading-tight">
          {label}
        </span>
        <span className="text-lg font-bold tracking-tight tabular-nums leading-tight">
          {value}
        </span>
      </div>
    </div>
  );
}
