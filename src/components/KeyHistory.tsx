import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  History,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearHistory,
  formatRelativeTime,
  formatSize,
  isHistoryAvailable,
  listKeys,
  removeKey,
  searchKeys,
} from "@/lib/keyHistory";
import type { KeyRecord } from "@/lib/keyHistory";

/** 父组件写入/删除成功后 dispatch 此事件，触发列表刷新 */
export const HISTORY_REFRESH_EVENT = "textdb:history-refresh";

interface KeyHistoryProps {
  /** 点击某个 key 时触发（通常用于填入输入框并读取） */
  onSelect?: (key: string) => void;
}

export function KeyHistory({ onSelect }: KeyHistoryProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [available] = useState(() => isHistoryAvailable());
  // 修订号：写入/删除/跨标签页变化时递增，触发 useMemo 重新计算
  const [revision, setRevision] = useState(0);

  const records: KeyRecord[] = useMemo(() => {
    if (!available) return [];
    return query ? searchKeys(query) : listKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, available, revision]);

  // 监听跨标签页 storage 变化 + 外部刷新事件
  useEffect(() => {
    if (!available) return;
    const bump = () => setRevision((r) => r + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "textdb_key_history") bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(HISTORY_REFRESH_EVENT, bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HISTORY_REFRESH_EVENT, bump);
    };
  }, [available]);

  if (!available) return null;

  function handleRemove(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    removeKey(key);
    setRevision((r) => r + 1);
    toast.info(`已从本地记录移除 "${key}"`);
  }

  function handleClear() {
    if (records.length === 0) return;
    if (!window.confirm(`确定清空全部 ${records.length} 条本地记录？\n（仅清除本地浏览记录，不影响服务端数据）`)) {
      return;
    }
    clearHistory();
    setQuery("");
    setRevision((r) => r + 1);
    toast.success("已清空本地记录");
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            最近写入
            <span className="text-sm font-normal text-muted-foreground">
              ({records.length})
            </span>
          </CardTitle>
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="flex flex-col gap-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索 key…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* 列表 */}
          {records.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {query ? "没有匹配的 key" : "还没有写入记录"}
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {records.map((r) => (
                <div
                  key={r.key}
                  className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                  onClick={() => onSelect?.(r.key)}
                >
                  <code className="flex-1 truncate font-mono text-sm">{r.key}</code>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(r.lastWrittenAt)}
                  </span>
                  {r.size !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {formatSize(r.size)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => handleRemove(r.key, e)}
                    title="从本地记录移除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 底部操作 */}
          {records.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClear}
              >
                清空本地记录
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
