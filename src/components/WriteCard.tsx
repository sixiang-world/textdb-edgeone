import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { writeData, deleteData, readData } from "@/api";
import { toast } from "sonner";

const BASE = location.origin;

const COLLAPSE_HEAD = 5;
const COLLAPSE_TAIL = 5;

/** 折叠预览：首 5 行 + "..." + 末 5 行；行数不足时返回 null */
function getCollapsedPreview(text: string): string | null {
  const lines = text.split("\n");
  if (lines.length <= COLLAPSE_HEAD + COLLAPSE_TAIL) return null;
  return (
    lines.slice(0, COLLAPSE_HEAD).join("\n") +
    "\n...\n" +
    lines.slice(-COLLAPSE_TAIL).join("\n")
  );
}

const TEXT_ACCEPT = [
  ".txt", ".log", ".csv", ".tsv",
  ".html", ".htm", ".css", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".scss", ".sass", ".less",
  ".json", ".xml", ".svg", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env", ".properties",
  ".md", ".mdx", ".rst", ".tex",
  ".sh", ".bash", ".zsh", ".py", ".rb", ".php", ".pl", ".lua",
  ".c", ".cpp", ".h", ".hpp", ".rs", ".go", ".java", ".kt", ".swift", ".sql",
  ".graphql", ".gradle", ".proto", ".Dockerfile", ".editorconfig",
].join(",");

/** Heuristic: does the value look like HTML? */
function looksLikeHtml(value: string): boolean {
  const s = value.trimStart();
  return (
    s.startsWith("<!") ||
    s.startsWith("<html") ||
    s.startsWith("<body") ||
    s.startsWith("<head") ||
    s.includes("</html>") ||
    s.includes("</body>") ||
    s.includes("</head>")
  );
}

/** Heuristic: does the value look like JavaScript / UserScript? */
function looksLikeJs(value: string): boolean {
  const s = value.trimStart();
  return (
    s.startsWith("// ==UserScript==") ||
    s.startsWith("// @") ||
    s.startsWith("function ") ||
    s.startsWith("const ") ||
    s.startsWith("let ") ||
    s.startsWith("var ") ||
    s.startsWith("import ") ||
    s.startsWith("export ") ||
    s.startsWith("async function") ||
    s.startsWith("window.") ||
    s.startsWith("document.")
  );
}

export function WriteCard({ onStatsRefresh }: { onStatsRefresh?: () => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [loadingOp, setLoadingOp] = useState<"write" | "read" | "delete" | null>(null);
  const [result, setResult] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");   // /{key} 源链接
  const [renderUrl, setRenderUrl] = useState("");    // /p/{key} HTML 渲染链接（仅 HTML）
  const [jsUrl, setJsUrl] = useState("");            // /js/{key} JS 链接（仅 JS 内容）
  const [readOnly, setReadOnly] = useState(false);   // 读取后锁定编辑

  function genKey() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let k = "k_";
    for (let i = 0; i < 16; i++) k += c[Math.floor(Math.random() * c.length)];
    setKey(k);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB（服务端限制）
    if (file.size > MAX_SIZE) {
      toast.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 5 MiB`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast.error("文件读取失败");
    reader.onload = () => {
      const text = reader.result as string;
      setValue(text);
      // 上传后默认折叠（仅当内容足够长时）
      setCollapsed(getCollapsedPreview(text) !== null);
      if (!key) genKey();
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleWrite() {
    if (!key) return toast.error("请输入 Key");
    if (!value) return toast.error("请输入内容");
    setLoadingOp("write");
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    setJsUrl("");
    try {
      const d = await writeData(key, value);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) {
        setSourceUrl(`${BASE}/${key}`);
        if (looksLikeHtml(value)) {
          setRenderUrl(`${BASE}/p/${key}`);
        }
        if (looksLikeJs(value)) {
          setJsUrl(`${BASE}/file/js/${key}`);
        }
        toast.success("写入成功");
        onStatsRefresh?.();
      } else toast.error(d.error || "写入失败");
    } catch (e: unknown) {
      setResult("请求失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingOp(null);
    }
  }

  async function handleDelete() {
    if (!key) return toast.error("请输入 Key");
    setLoadingOp("delete");
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    setJsUrl("");
    try {
      const d = await deleteData(key);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) {
        toast.success("已删除");
        onStatsRefresh?.();
      } else toast.error(d.error || "删除失败");
    } catch (e: unknown) {
      setResult("请求失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingOp(null);
    }
  }

  async function handleRead() {
    if (!key) return toast.error("请输入 Key");
    setLoadingOp("read");
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    setJsUrl("");
    setReadOnly(false);
    try {
      const t = await readData(key);
      if (t) {
        setValue(t);
        setSourceUrl(`${BASE}/${key}`);
        if (looksLikeHtml(t)) setRenderUrl(`${BASE}/p/${key}`);
        if (looksLikeJs(t)) setJsUrl(`${BASE}/file/js/${key}`);
        const preview = getCollapsedPreview(t);
        if (preview !== null) setCollapsed(true);
        setReadOnly(true);
        toast.success("读取成功");
      } else {
        setResult("Key 不存在");
        toast.error("Key 不存在");
      }
    } catch (e: unknown) {
      setResult("请求失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingOp(null);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>写入 / 更新 / 读取</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="my_data_key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRead()}
          />
          <Button variant="outline" size="icon" onClick={genKey}>
            <Shuffle />
          </Button>
        </div>
        {(() => {
          const preview = getCollapsedPreview(value);
          const canCollapse = preview !== null;
          if (collapsed && canCollapse) {
            return (
              <div className="rounded-md border bg-muted/30 font-mono text-sm">
                <pre className="p-3 whitespace-pre-wrap break-all overflow-auto max-h-72 leading-relaxed">
                  {preview}
                </pre>
                <div className="border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(false)}
                  >
                    <ChevronDown />
                    展开全部
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-2">
              {readOnly && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReadOnly(false)}
                    className="gap-1.5"
                  >
                    <Lock className="size-3.5" />
                    只读模式
                  </Button>
                  <span>— 点击解锁后可编辑</span>
                </div>
              )}
              <Textarea
                placeholder="在此输入文本内容..."
                rows={5}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
                readOnly={readOnly}
              />
              {canCollapse && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setCollapsed(true)}
                >
                  <ChevronUp />
                  折叠预览
                </Button>
              )}
            </div>
          );
        })()}

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="relative">
            <Upload />
            上传文本文件
            <input
              type="file"
              accept={TEXT_ACCEPT}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
          </Button>
          <p className="text-xs text-muted-foreground">
            支持 HTML/CSS/JS/MD 等文本文件，可在文件对话框切换"所有文件"
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleWrite} disabled={loadingOp !== null}>
            {loadingOp === "write" ? <Loader2 className="animate-spin" /> : <Upload />}
            写入
          </Button>
          <Button variant="outline" onClick={handleRead} disabled={loadingOp !== null}>
            {loadingOp === "read" ? <Loader2 className="animate-spin" /> : <Search />}
            读取
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={loadingOp !== null}>
            {loadingOp === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            删除此 Key
          </Button>
        </div>

        {/* 源链接（始终显示） */}
        {sourceUrl && (
          <div className="rounded-md border bg-muted p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-4 break-all flex-1"
            >
              {sourceUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(sourceUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}

        {/* 二维码 */}
        {sourceUrl && (
          <div className="flex justify-center pt-1">
            <QrCode url={sourceUrl} />
          </div>
        )}

        {/* JS 链接（仅 JS 内容时显示） */}
        {jsUrl && (
          <div className="rounded-md border bg-muted p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={jsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-4 break-all flex-1"
            >
              {jsUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(jsUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}

        {/* HTML 渲染链接（仅 HTML 内容时显示） */}
        {renderUrl && (
          <div className="rounded-md border bg-primary/5 p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-primary" />
            <a
              href={renderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary underline underline-offset-4 break-all flex-1"
            >
              {renderUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={() => copyUrl(renderUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        )}

        {result && (
          <pre className="rounded-md border bg-muted p-4 text-sm font-mono break-all max-h-48 overflow-auto">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
