import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WriteCard } from "@/components/WriteCard";
import { ReadCard } from "@/components/ReadCard";
import { ApiDocs } from "@/components/ApiDocs";
import { Changelog } from "@/components/Changelog";
import { MdRenderer } from "@/components/MdRenderer";
import { FolderUpload } from "@/components/FolderUpload";
import { StatsCard } from "@/components/StatsCard";
import { Toaster } from "@/components/ui/sonner";
import { Database, ExternalLink } from "lucide-react";

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
            <TabsTrigger value="changelog">版本日志</TabsTrigger>
          </TabsList>

          <TabsContent value="operate" className="flex flex-col gap-6 mt-0">
            <WriteCard />
            <FolderUpload />
            <ReadCard />
          </TabsContent>

          <TabsContent value="api" className="mt-0">
            <ApiDocs />
          </TabsContent>

          <TabsContent value="changelog" className="mt-0">
            <Changelog />
          </TabsContent>
        </Tabs>
      </main>

      <div className="max-w-3xl mx-auto px-4">
        <StatsCard />
      </div>

      <footer className="border-t mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-center gap-3">
          <span className="text-sm font-semibold tracking-tight">
            TextDB EdgeOne
          </span>
          <span className="text-muted-foreground/40">·</span>
          <a
            href="https://pages.edgeone.ai"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground hover:shadow-md"
            target="_blank"
            rel="noreferrer"
          >
            <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-wide">
              EdgeOne
            </span>
            Pages
            <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/sixiang-world/textdb-edgeone"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground hover:shadow-md"
            target="_blank"
            rel="noreferrer"
          >
            <svg
              className="size-3.5"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
            <ExternalLink className="size-3" />
          </a>
        </div>
      </footer>

      <Toaster />
    </>
  );
}
