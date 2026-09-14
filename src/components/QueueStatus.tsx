import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  discardItem,
  MAX_RETRIES,
  retryAll,
  retryItem,
  subscribe,
  type QueueItem,
} from "@/lib/writeQueue";

export function QueueStatus() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    return subscribe(setItems);
  }, []);

  const pending = items.filter((i) => i.status === "pending" || i.status === "processing");
  const errors = items.filter((i) => i.status === "error");
  const total = items.length;

  // 队列为空时不显示
  if (total === 0) return null;

  function typeIcon(item: QueueItem) {
    if (item.type === "write") return "写入";
    if (item.type === "delete") return "删除";
    return "上传";
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* 展开面板 */}
      {expanded && (
        <div className="w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">写入队列 ({total})</span>
            <div className="flex items-center gap-1">
              {errors.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => retryAll()}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  全部重试
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setExpanded(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 border-b px-3 py-2 last:border-0"
              >
                {item.status === "error" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {typeIcon(item)}
                    </span>
                    <code className="truncate font-mono text-xs">{item.key}</code>
                  </div>
                  {item.status === "error" && item.lastError && (
                    <div className="truncate text-xs text-destructive">
                      {item.lastError}
                      {item.retryCount > 0 && ` (已重试 ${item.retryCount} 次)`}
                    </div>
                  )}
                  {item.status !== "error" && item.retryCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      重试中 ({item.retryCount}/{MAX_RETRIES})
                    </div>
                  )}
                </div>
                {item.status === "error" && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => retryItem(item.id)}
                      title="重试"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={() => discardItem(item.id)}
                      title="丢弃"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 浮动指示器 */}
      <button
        className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-lg transition-shadow hover:shadow-xl"
        onClick={() => setExpanded(!expanded)}
      >
        {pending.length > 0 && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {errors.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
            {errors.length}
          </span>
        )}
        {pending.length > 0 && (
          <span className="text-xs text-muted-foreground">{pending.length} 待处理</span>
        )}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
