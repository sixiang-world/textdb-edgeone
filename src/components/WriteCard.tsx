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

export function WriteCard() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");

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
    setSharedUrl("");
    try {
      const d = await writeData(key, value);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) {
        setSharedUrl(`${BASE}/p/${key}`);
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
    setSharedUrl("");
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

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(sharedUrl);
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

        <div className="flex gap-2 items-center">
          <Button variant="outline" className="relative">
            <Upload />
            上传 HTML 文件
            <input
              type="file"
              accept=".html,.htm"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
          </Button>
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

        {sharedUrl && (
          <div className="rounded-md border bg-primary/5 p-4 flex items-center gap-3">
            <ExternalLink className="size-4 shrink-0 text-primary" />
            <a
              href={sharedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono text-primary underline underline-offset-4 break-all flex-1"
            >
              {sharedUrl}
            </a>
            <Button variant="ghost" size="icon" onClick={copyUrl}>
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
