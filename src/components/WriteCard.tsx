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
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
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
  const [sourceUrl, setSourceUrl] = useState("");
  const [renderUrl, setRenderUrl] = useState("");
  const [jsUrl, setJsUrl] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPwdOptions, setShowPwdOptions] = useState(false);

  function genKey() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let k = "k_";
    for (let i = 0; i < 16; i++) k += c[Math.floor(Math.random() * c.length)];
    setKey(k);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
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
      const pwd = password || undefined;
      const npwd = showPwdOptions ? newPassword : undefined;
      const d = await writeData(key, value, pwd, npwd);
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
      const d = await deleteData(key, password || undefined);
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
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          写入 / 更新 / 读取
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Key input row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="my_data_key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRead()}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={genKey} title="随机生成 Key">
            <Shuffle className="size-4" />
          </Button>
        </div>

        {/* Password section */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-muted-foreground shrink-0" />
            <div className="relative flex-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password（写入时设置，更新/删除时验证）"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (!e.target.value) {
                    setShowPwdOptions(false);
                    setNewPassword("");
                  }
                }}
                className="pl-3 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {password && (
            <div className="flex flex-col gap-2 pl-5">
              <button
                type="button"
                onClick={() => setShowPwdOptions(!showPwdOptions)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition self-start"
              >
                {showPwdOptions ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRightIcon className="size-3" />
                )}
                {showPwdOptions ? "收起" : "更换 / 移除密码"}
              </button>

              {showPwdOptions && (
                <div className="flex flex-col gap-2 pl-2 border-l-2 border-muted-foreground/20">
                  <Input
                    type="password"
                    placeholder="新密码（留空即移除密码保护）"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    当前密码验证通过后生效
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content editor area */}
        <div className="flex flex-col gap-2">
          {readOnly && (
            <div className="flex items-center gap-2 rounded-md border bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="size-3 text-amber-500" />
              <span>只读模式 — </span>
              <button
                type="button"
                onClick={() => setReadOnly(false)}
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition"
              >
                点击解锁
              </button>
              <span>后可编辑</span>
            </div>
          )}

          {(() => {
            const preview = getCollapsedPreview(value);
            const canCollapse = preview !== null;

            if (collapsed && canCollapse) {
              return (
                <div className="rounded-lg border bg-muted/30 font-mono text-sm">
                  <pre className="p-3 whitespace-pre-wrap break-all overflow-auto max-h-48 leading-relaxed text-xs">
                    {preview}
                  </pre>
                  <div className="border-t px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {value.split("\n").length} 行
                    </span>
                    <button
                      type="button"
                      onClick={() => setCollapsed(false)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronDown className="size-3" />
                      展开全部
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="在此输入文本内容..."
                  rows={5}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="font-mono text-sm"
                  readOnly={readOnly}
                />
                <div className="flex items-center justify-between">
                  {value && (
                    <span className="text-[11px] text-muted-foreground">
                      {value.length.toLocaleString()} 字符
                      · {value.split("\n").length} 行
                    </span>
                  )}
                  {canCollapse && (
                    <button
                      type="button"
                      onClick={() => setCollapsed(true)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronUp className="size-3" />
                      折叠
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* File upload */}
        <div className="flex flex-col gap-1.5">
          <Button variant="outline" size="sm" className="relative w-full justify-start gap-2">
            <FileUp className="size-4" />
            上传文本文件
            <input
              type="file"
              accept={TEXT_ACCEPT}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
          </Button>
          <p className="text-[11px] text-muted-foreground px-1">
            支持 HTML / CSS / JS / MD 等文本格式，可在对话框切换「所有文件」
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleWrite}
            disabled={loadingOp !== null}
            className="flex-1"
          >
            {loadingOp === "write" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            写入
          </Button>
          <Button
            variant="secondary"
            onClick={handleRead}
            disabled={loadingOp !== null}
            className="flex-1"
          >
            {loadingOp === "read" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            读取
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loadingOp !== null}
            className="flex-1"
          >
            {loadingOp === "delete" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            删除
          </Button>
        </div>

        {/* URL results */}
        {sourceUrl && (
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3 shadow-xs">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <ExternalLink className="size-3.5 text-primary" />
            </div>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/60 break-all flex-1 min-w-0"
            >
              {sourceUrl}
            </a>
            <Button variant="ghost" size="icon-xs" onClick={() => copyUrl(sourceUrl)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        {/* QR code */}
        {sourceUrl && (
          <div className="flex justify-center">
            <QrCode url={sourceUrl} />
          </div>
        )}

        {/* JS link */}
        {jsUrl && (
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3 shadow-xs">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
              <ExternalLink className="size-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <a
              href={jsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/60 break-all flex-1 min-w-0"
            >
              {jsUrl}
            </a>
            <Button variant="ghost" size="icon-xs" onClick={() => copyUrl(jsUrl)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        {/* HTML render link */}
        {renderUrl && (
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3 shadow-xs">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <ExternalLink className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <a
              href={renderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/60 break-all flex-1 min-w-0"
            >
              {renderUrl}
            </a>
            <Button variant="ghost" size="icon-xs" onClick={() => copyUrl(renderUrl)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Result JSON */}
        {result && (
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition">
              <ChevronDown className="size-3 transition group-open:rotate-180" />
              返回结果
            </summary>
            <pre className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs font-mono break-all max-h-48 overflow-auto leading-relaxed">
              {result}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** Inline component to avoid pulling in a full icon import */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
