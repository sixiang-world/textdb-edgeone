import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, Copy, ExternalLink, FileUp, Files, FolderOpen, Loader2, Shuffle, Upload } from "lucide-react";
import { uploadFile } from "@/api";
import { pathToKey, rewriteRefs, isBinary } from "@/lib/folderUtils";
import type { UploadItem, UploadResult } from "@/lib/folderUtils";
import { toast } from "sonner";

const BASE = location.origin;

export function FolderUpload({ onStatsRefresh }: { onStatsRefresh?: () => void }) {
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [entryUrl, setEntryUrl] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  function genPrefix() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let p = "site_";
    for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
    setPrefix(p);
    return p;
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const fileCount = fileList.length;

    setResults([]);
    setEntryUrl("");
    setFiles([]);
    setReading(true);

    const effectivePrefix = prefix || genPrefix();

    const items: UploadItem[] = [];
    const skipped: string[] = [];
    let processed = 0;

    const safetyTimer = setTimeout(() => {
      if (processed < fileCount) {
        toast.warning(`读取超时 (${processed}/${fileCount})，仅已读取的文件保留`);
        setFiles(items);
        setReading(false);
      }
    }, 30000);

    function tryComplete() {
      processed++;
      if (processed === fileCount) {
        clearTimeout(safetyTimer);
        if (skipped.length > 0) {
          toast.warning(`跳过 ${skipped.length} 个文件`);
        }
        setFiles(items);
        setReading(false);
      }
    }

    for (let i = 0; i < fileCount; i++) {
      const f = fileList[i] as File & { webkitRelativePath?: string };
      const relPath = f.webkitRelativePath || f.name;

      const reader = new FileReader();
      reader.onerror = () => {
        skipped.push(relPath);
        tryComplete();
      };
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result !== "string") {
          skipped.push(relPath);
        } else {
          const content = result;
          if (isBinary(content)) {
            skipped.push(relPath);
          } else {
            items.push({
              relativePath: relPath,
              name: f.name,
              content,
              key: pathToKey(effectivePrefix, relPath),
            });
          }
        }
        tryComplete();
      };
      reader.onabort = () => {
        skipped.push(relPath);
        tryComplete();
      };
      reader.readAsText(f);
    }

    e.target.value = "";
  }

  async function handleUpload() {
    if (files.length === 0) return toast.error("请先选择文件夹");
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setResults([]);
    setEntryUrl("");

    const toUpload: UploadItem[] = files;

    const fileMap = new Map<string, string>();
    for (const f of toUpload) {
      const normalized = f.relativePath.replace(/^\.{1,2}\//, "");
      fileMap.set(normalized, f.key);
    }

    const rewritten: UploadItem[] = toUpload.map(f => {
      if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
        return {
          ...f,
          content: rewriteRefs(f.content, prefix, fileMap, f.relativePath),
        };
      }
      return f;
    });

    const allResults: UploadResult[] = [];
    for (let i = 0; i < rewritten.length; i++) {
      const res = await uploadFile(rewritten[i]);
      allResults.push(res);
      setProgress({ done: i + 1, total: rewritten.length });
    }

    setResults(allResults);
    setUploading(false);

    const succeeded = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    toast.success(`上传完成: ${succeeded} 成功${failed > 0 ? `, ${failed} 失败` : ""}`);
    onStatsRefresh?.();

    const entry = rewritten.find(
      f => f.relativePath.endsWith("/index.html") || f.relativePath === "index.html"
    );
    if (entry) {
      setEntryUrl(`${BASE}/p/${entry.key}`);
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          文件夹上传
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Prefix + folder picker */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              placeholder="项目前缀 (如 mysite)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="pl-3"
            />
          </div>
          <Button variant="outline" size="icon" onClick={genPrefix} title="随机生成前缀">
            <Shuffle className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="relative w-full justify-start gap-2"
            disabled={uploading}
          >
            <FolderOpen className="size-4" />
            选择文件夹
            <input
              ref={inputRef}
              type="file"
              // @ts-expect-error webkitdirectory is supported in all modern browsers
              webkitdirectory=""
              directory=""
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFolderSelect}
            />
          </Button>
          <p className="text-[11px] text-muted-foreground px-1">
            建议扁平结构（css/、js/ 直接放根目录），自动重写 HTML 引用路径
          </p>
        </div>

        {/* Loading indicator */}
        {reading && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            正在读取文件...
          </div>
        )}

        {/* File list preview */}
        {files.length > 0 && (
          <div className="rounded-lg border bg-card overflow-hidden">
            {/* Summary bar */}
            <div className="flex items-center justify-between px-3 py-2">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
              >
                {collapsed ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
                <Files className="size-3.5" />
                <span>{files.length} 个文件</span>
              </button>
              {!uploading && (
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-destructive hover:underline"
                >
                  清空
                </button>
              )}
            </div>

            {/* Expanded list */}
            {!collapsed && (
              <div className="border-t max-h-60 overflow-auto">
                {files.map((f, i) => (
                  <div
                    key={f.relativePath}
                    className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-border/40 last:border-0 hover:bg-muted/30 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileUp className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">
                        {f.relativePath}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <code className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1 py-0.5">
                        {f.key}
                      </code>
                      {!uploading && (
                        <button
                          onClick={() => removeFile(i)}
                          className="text-destructive hover:underline"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        {files.length > 0 && !uploading && !results.length && (
          <Button onClick={handleUpload}>
            <Upload />
            上传 {files.length} 个文件
          </Button>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              上传中... {progress.done}/{progress.total}
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                ✅ {results.filter(r => r.success).length} 成功
              </span>
              {results.filter(r => !r.success).length > 0 && (
                <span className="font-medium text-destructive ml-1">
                  ❌ {results.filter(r => !r.success).length} 失败
                </span>
              )}
            </div>
            {results.filter(r => !r.success).length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground max-h-24 overflow-auto font-mono">
                {results.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="py-0.5">
                    {r.key}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entry link */}
        {entryUrl && (
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3 shadow-xs">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <ExternalLink className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <a
              href={entryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/60 break-all flex-1 min-w-0"
            >
              {entryUrl}
            </a>
            <Button variant="ghost" size="icon-xs" onClick={() => copyUrl(entryUrl)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
