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
import { ChevronDown, ChevronUp, Copy, ExternalLink, FolderOpen, Eye, EyeOff, Loader2, Shuffle, Upload } from "lucide-react";
import { uploadFile } from "@/api";
import { recordKey } from "@/lib/keyHistory";
import { pathToKey, rewriteRefs, isBinary } from "@/lib/folderUtils";
import type { UploadItem, UploadResult } from "@/lib/folderUtils";
import { toast } from "sonner";

const BASE = location.origin;

export function FolderUpload({ onStatsRefresh }: { onStatsRefresh?: () => void }) {
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [reading, setReading] = useState(false);      // loading indicator while FileReader is working
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [entryUrl, setEntryUrl] = useState("");
  const [collapsed, setCollapsed] = useState(true);    // file list collapsed by default
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function genPrefix() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let p = "site_";
    for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
    setPrefix(p);
    return p;  // return for immediate use in callbacks (setState is async)
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const fileCount = fileList.length;  // capture for TS narrowing in closures

    // Reset previous upload state
    setResults([]);
    setEntryUrl("");
    setFiles([]);           // replace, not append
    setReading(true);       // show loading indicator

    // Capture effective prefix NOW (React setState is async, callbacks need the correct value)
    const effectivePrefix = prefix || genPrefix();

    const items: UploadItem[] = [];
    const skipped: string[] = [];
    let processed = 0;

    // Safety timeout: if files aren't processed in 30s, force-exit reading state
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
      const f = fileList![i] as File & { webkitRelativePath?: string };
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

    // Use keys as computed at selection time (not recomputed with current prefix).
    // This ensures the file list display matches what gets uploaded.
    // If the user changed prefix after selection, those changes are intentionally ignored
    // to avoid silent key mismatches between display and upload.
    const toUpload: UploadItem[] = files;

    // Build file map using the already-finalized keys from selection time.
    const fileMap = new Map<string, string>();
    for (const f of toUpload) {
      const normalized = f.relativePath.replace(/^\.{1,2}\//, "");
      fileMap.set(normalized, f.key);
    }

    // Rewrite HTML refs against the upload key map
    const rewritten: UploadItem[] = toUpload.map(f => {
      if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
        return {
          ...f,
          content: rewriteRefs(f.content, prefix, fileMap, f.relativePath),
        };
      }
      return f;
    });

    // Upload one-by-one (respect rate limits, track progress)
    const allResults: UploadResult[] = [];
    const pwd = password || undefined;
    for (let i = 0; i < rewritten.length; i++) {
      const res = await uploadFile(rewritten[i], pwd);
      allResults.push(res);
      if (res.success) recordKey(res.key);
      setProgress({ done: i + 1, total: rewritten.length });
    }

    setResults(allResults);
    setUploading(false);

    const succeeded = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    toast.success(`上传完成: ${succeeded} 成功${failed > 0 ? `, ${failed} 失败` : ""}`);
    onStatsRefresh?.();

    // Find entry point (index.html)
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
        <CardTitle>文件夹上传</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Project prefix + folder picker */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="项目前缀 (如 mysite)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={genPrefix} title="随机生成">
            <Shuffle className="size-4" />
          </Button>
        </div>

        {/* Password input */}
        <div className="flex gap-2 items-center">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password (set on write, verify on update/delete)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-mono flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            type="button"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          密码将应用于本次上传的所有文件。空白 = 不设密码保护。
        </p>

        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            className="relative"
            disabled={uploading}
          >
            <FolderOpen />
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
          <span className="text-xs text-muted-foreground">
            选择包含 HTML/CSS/JS 的文件夹，建议扁平结构（如 css/、js/ 直接放根目录）
          </span>
        </div>

        {/* File list preview — collapsed summary bar by default */}
        {reading && (
          <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            正在读取文件...
          </div>
        )}
        {files.length > 0 && (
          <div className="rounded-md border bg-muted p-3 text-sm">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
              >
                {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                <span>📄 {files.length} 个文件</span>
              </button>
              <div className="flex items-center gap-2">
                {!uploading && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-destructive hover:underline"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* Expanded file list */}
            {!collapsed && (
              <div className="mt-2 font-mono text-xs max-h-48 overflow-auto">
                {files.map((f, i) => (
                  <div key={f.relativePath} className="flex items-center justify-between py-1 border-t border-border/50">
                    <span className="text-muted-foreground truncate flex-1">
                      📄 {f.relativePath}
                    </span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      → {f.key}
                    </span>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(i)}
                        className="ml-2 text-destructive hover:underline shrink-0"
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        {files.length > 0 && !uploading && !results.length && (
          <Button onClick={handleUpload} className="w-full">
            <Upload />
            上传 {files.length} 个文件
          </Button>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              上传中... {progress.done}/{progress.total}
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && (
          <div className="rounded-md border p-4 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span>
                ✅ {results.filter(r => r.success).length} 成功
                {results.filter(r => !r.success).length > 0 && (
                  <span className="text-destructive ml-2">
                    ❌ {results.filter(r => !r.success).length} 失败
                  </span>
                )}
              </span>
            </div>
            {results.filter(r => !r.success).length > 0 && (
              <div className="text-xs text-muted-foreground max-h-24 overflow-auto">
                {results.filter(r => !r.success).map((r, i) => (
                  <div key={i}>{r.key}: {r.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entry link */}
        {entryUrl && (
          <div className="rounded-md border bg-primary/5 p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-primary" />
            <a
              href={entryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary underline underline-offset-4 break-all flex-1"
            >
              {entryUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(entryUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
