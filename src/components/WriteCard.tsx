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
import { Copy, ExternalLink, Loader2, Shuffle, Trash2, Upload } from "lucide-react";
import { writeData, deleteData } from "@/api";
import { toast } from "sonner";

const BASE = location.origin;

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

export function WriteCard() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");   // /{key} 源链接
  const [renderUrl, setRenderUrl] = useState("");    // /p/{key} HTML 渲染链接（仅 HTML）

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
      if (!key) genKey();
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleWrite() {
    if (!key) return toast.error("请输入 Key");
    if (!value) return toast.error("请输入内容");
    setLoading(true);
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    try {
      const d = await writeData(key, value);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) {
        setSourceUrl(`${BASE}/${key}`);
        if (looksLikeHtml(value)) {
          setRenderUrl(`${BASE}/p/${key}`);
        }
        toast.success("写入成功");
      } else toast.error(d.error || "写入失败");
    } catch (e: any) {
      setResult("请求失败: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!key) return toast.error("请输入 Key");
    setLoading(true);
    setResult("");
    setSourceUrl("");
    setRenderUrl("");
    try {
      const d = await deleteData(key);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) toast.success("已删除");
      else toast.error(d.error || "删除失败");
    } catch (e: any) {
      setResult("请求失败: " + e.message);
    } finally {
      setLoading(false);
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
        <CardTitle>写入 / 更新</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="my_data_key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={genKey}>
            <Shuffle />
          </Button>
        </div>
        <Textarea
          placeholder="在此输入文本内容..."
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="font-mono"
        />

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
          <Button onClick={handleWrite} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            写入
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={loading}>
            <Trash2 />
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
