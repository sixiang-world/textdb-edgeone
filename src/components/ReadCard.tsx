import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readData } from "@/api";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { QrCode } from "@/components/QrCode";

export function ReadCard() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleRead() {
    if (!key) return toast.error("请输入 Key");
    setLoading(true);
    setResult("");
    try {
      const t = await readData(key);
      setResult(t || "（Key 不存在）");
    } catch (e: any) {
      setResult("请求失败: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>读取</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="输入 Key 读取数据"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRead()}
          />
          <Button onClick={handleRead} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            读取
          </Button>
        </div>
        {result && (
          <div className="flex flex-col gap-4">
            <pre className="rounded-md border bg-muted p-4 text-sm font-mono break-all max-h-48 overflow-auto">
              {result}
            </pre>
            {result !== "（Key 不存在）" &&
              result !== "" &&
              !result.startsWith("请求失败") && (
              <div className="flex justify-center">
                <QrCode url={`${location.origin}/${key}`} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
