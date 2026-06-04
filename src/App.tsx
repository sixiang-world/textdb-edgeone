import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WriteCard } from "@/components/WriteCard";
import { ReadCard } from "@/components/ReadCard";
import { ApiDocs } from "@/components/ApiDocs";
import { MdRenderer } from "@/components/MdRenderer";
import { FolderUpload } from "@/components/FolderUpload";
import { Toaster } from "@/components/ui/sonner";
import { Database } from "lucide-react";

export default function App() {
  // /md/{key} 路由 — SPA 自行解析
  if (window.location.pathname.startsWith("/md/")) {
    return (
      <>
        <MdRenderer />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-3">
          <Database className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TextDB EdgeOne</h1>
            <p className="text-sm text-muted-foreground">
              基于 EdgeOne Pages + KV 的在线文本数据库
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Tabs defaultValue="operate" className="flex flex-col gap-6">
          <TabsList>
            <TabsTrigger value="operate">操作</TabsTrigger>
            <TabsTrigger value="api">API 文档</TabsTrigger>
          </TabsList>

          <TabsContent value="operate" className="flex flex-col gap-6 mt-0">
            <WriteCard />
            <FolderUpload />
            <ReadCard />
          </TabsContent>

          <TabsContent value="api" className="mt-0">
            <ApiDocs />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          TextDB EdgeOne ·{" "}
          <a
            href="https://github.com/sixiang-world/textdb-edgeone"
            className="hover:text-foreground transition"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>

      <Toaster />
    </>
  );
}
