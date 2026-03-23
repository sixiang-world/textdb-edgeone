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
import { writeData, deleteData } from "@/api";
import { toast } from "sonner";
import { Loader2, Shuffle, Trash2 } from "lucide-react";

export function WriteCard() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  function genKey() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let k = "k_";
    for (let i = 0; i < 16; i++) k += c[Math.floor(Math.random() * c.length)];
    setKey(k);
  }

  async function handleWrite() {
    if (!key) return toast.error("请输入 Key");
    if (!value) return toast.error("请输入 Value");
    setLoading(true);
    setResult("");
    try {
      const d = await writeData(key, value);
      setResult(JSON.stringify(d, null, 2));
      if (d.status === 1) toast.success("写入成功");
      else toast.error(d.error || "写入失败");
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
        {result && (
          <pre className="rounded-md border bg-muted p-4 text-sm font-mono break-all max-h-48 overflow-auto">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
