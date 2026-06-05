import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

const B = location.origin;

const endpoints = [
  { method: "POST", color: "default" as const, path: "/update/", desc: "写入 / 更新 / 删除" },
  { method: "GET", color: "secondary" as const, path: "/{key}", desc: "读取数据" },
  { method: "GET", color: "secondary" as const, path: "/p/{key}", desc: "HTML 渲染" },
  { method: "GET", color: "secondary" as const, path: "/md/{key}", desc: "Markdown 渲染" },
  { method: "GET", color: "secondary" as const, path: "/js/{key}", desc: "JavaScript 直出（application/javascript）" },
  { method: "POST", color: "default" as const, path: "/{key}", desc: "直接写入（简写）" },
  { method: "DELETE", color: "destructive" as const, path: "/{key}", desc: "删除数据" },
];

const params = [
  { name: "key", required: true, desc: "文本标识，仅支持字母、数字、下划线，最长 512 字符" },
  { name: "value", required: false, desc: "文本数据，最大 5 MiB。留空则删除" },
];

const curlCode = `# 写入
curl -X POST "${B}/update/" \\
  -d "key=mykey&value=hello world"

# 读取
curl "${B}/mykey"

# 删除
curl -X DELETE "${B}/mykey"`;

const pyCode = `import requests

# 写入
requests.post("${B}/update/",
  data={"key": "mykey", "value": "hello world"})

# 读取
print(requests.get("${B}/mykey").text)

# 删除
requests.delete("${B}/mykey")`;

const jsCode = `// 写入
await fetch("${B}/update/", {
  method: "POST",
  headers: {"Content-Type": "application/x-www-form-urlencoded"},
  body: "key=mykey&value=hello world"
});

// 读取
const text = await (await fetch("${B}/mykey")).text();

// 删除
await fetch("${B}/mykey", {method: "DELETE"});`;

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(code);
            toast.success("已复制");
          }}
        >
          <Copy />
          复制
        </Button>
      </div>
      <pre className="rounded-md border bg-muted p-4 text-sm font-mono overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

export function ApiDocs() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>API 接口</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {endpoints.map((ep) => (
            <div key={ep.path + ep.method} className="flex items-center gap-3 text-sm">
              <Badge variant={ep.color}>{ep.method}</Badge>
              <code className="text-muted-foreground">{ep.path}</code>
              <span className="text-muted-foreground">{ep.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>请求参数（POST /update/）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>参数</TableHead>
                <TableHead>必填</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {params.map((p) => (
                <TableRow key={p.name}>
                  <TableCell>
                    <code className="text-sm">{p.name}</code>
                  </TableCell>
                  <TableCell>
                    {p.required ? (
                      <Badge variant="destructive" className="text-xs">
                        必填
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.desc}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>请求示例</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <CodeBlock code={curlCode} label="cURL" />
          <Separator />
          <CodeBlock code={pyCode} label="Python" />
          <Separator />
          <CodeBlock code={jsCode} label="JavaScript" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground flex flex-col gap-2 list-disc pl-4">
            <li>读取不限次数，每个 IP 每日写入/删除操作限 500 次</li>
            <li>数据无密码保护，建议使用随机 Key</li>
            <li>1 年未更新的记录会自动删除</li>
            <li>全程支持 CORS 跨域请求</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
