import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getStats, type Stats } from "@/api";
import { Hash, HardDrive, PencilLine, Loader2 } from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const s = await getStats();
        if (!cancelled) setStats(s);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardContent className="py-4">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="animate-spin size-4 text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              加载统计...
            </span>
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center">
            统计加载失败
          </p>
        ) : stats ? (
          <div className="flex flex-wrap gap-6 justify-center">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">总 Key 数</span>
              <span className="text-sm font-semibold tabular-nums">
                {stats.totalKeys}
                {!stats.scannedAll && "+"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">总存储量</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatSize(stats.totalSize)}
                {!stats.scannedAll && "+"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PencilLine className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">今日写入</span>
              <span className="text-sm font-semibold tabular-nums">
                {stats.writesToday}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
