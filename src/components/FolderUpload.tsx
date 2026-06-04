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
import { ChevronDown, ChevronUp, Copy, ExternalLink, FolderOpen, Loader2, Shuffle, Upload } from "lucide-react";
import { uploadFile } from "@/api";
import { pathToKey, rewriteRefs, buildFileMap, isBinary } from "@/lib/folderUtils";
import type { UploadItem, UploadResult } from "@/lib/folderUtils";
import { toast } from "sonner";

const BASE = location.origin;

export function FolderUpload() {
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [reading, setReading] = useState(false);      // loading indicator while FileReader is working
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [entryUrl, setEntryUrl] = useState("");
  const [collapsed, setCollapsed] = useState(true);    // file list collapsed by default
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

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      // webkitRelativePath gives the relative path within the folder
      const relPath = (f as any).webkitRelativePath || f.name;

      // Read file content
      const reader = new FileReader();
      reader.onerror = () => {
        skipped.push(relPath);
        processed++;
        // Check completion
        if (processed === fileList.length) {
          if (skipped.length > 0) {
            toast.warning(`跳过 ${skipped.length} 个二进制文件/错误文件`);
          }
          setFiles(items);
          setReading(false);
        }
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
        processed++;

        if (processed === fileList.length) {
          if (skipped.length > 0) {
            toast.warning(`跳过 ${skipped.length} 个二进制文件/错误文件`);
          }
          setFiles(items);
          setReading(false);
        }
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

    // Recompute keys based on current prefix (may have changed since selection)
    const toUpload: UploadItem[] = files.map(f => ({
      ...f,
      key: pathToKey(prefix, f.relativePath),
    }));

    // Build file map & rewrite HTML refs
    const fileMap = buildFileMap(prefix, toUpload);
    const rewritten: UploadItem[] = toUpload.map(f => {
      if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
        return {
          ...f,
          content: rewriteRefs(f.content, prefix, fileMap),
        };
      }
      return f;
    });

    // Upload one-by-one (respect rate limits, track progress)
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
              // @ts-ignore webkitdirectory is supported in all modern browsers
              webkitdirectory=""
              // @ts-ignore
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
