import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WriteCard } from "@/components/WriteCard";
import { ApiDocs } from "@/components/ApiDocs";
import { Changelog } from "@/components/Changelog";
import { MdRenderer } from "@/components/MdRenderer";
import { FolderUpload } from "@/components/FolderUpload";
import { StatsCard } from "@/components/StatsCard";
import { Toaster } from "@/components/ui/sonner";
import { Database, ExternalLink, Github } from "lucide-react";

export default function App() {
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  function onStatsRefresh() {
    setStatsRefreshTrigger((n) => n + 1);
  }

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
      {/* Top accent bar */}
      <div className="h-1 w-full bg-linear-to-r from-blue-500 via-indigo-500 to-violet-500" />

      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 shadow-sm">
            <Database className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              TextDB EdgeOne
            </h1>
            <p className="text-xs text-muted-foreground">
              基于 EdgeOne Pages + KV 的在线文本数据库
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Tabs defaultValue="operate" className="flex flex-col gap-6">
          <TabsList className="w-full">
            <TabsTrigger value="operate" className="flex-1">
              <Database className="size-3.5" />
              操作
            </TabsTrigger>
            <TabsTrigger value="api" className="flex-1">
              <ExternalLink className="size-3.5" />
              API 文档
            </TabsTrigger>
            <TabsTrigger value="changelog" className="flex-1">
              版本日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operate" className="flex flex-col gap-6 mt-0">
            <WriteCard onStatsRefresh={onStatsRefresh} />
            <FolderUpload onStatsRefresh={onStatsRefresh} />
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
        <StatsCard refreshTrigger={statsRefreshTrigger} />
      </div>

      <footer className="border-t mt-12">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-center gap-4 flex-wrap">
          <span className="text-xs font-semibold tracking-tight text-muted-foreground">
            TextDB EdgeOne
          </span>
          <span className="text-muted-foreground/30">·</span>
          <a
            href="https://pages.edgeone.ai"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium shadow-xs transition hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
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
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium shadow-xs transition hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
            target="_blank"
            rel="noreferrer"
          >
            <Github className="size-3.5" />
            GitHub
            <ExternalLink className="size-3" />
          </a>
        </div>
      </footer>

      <Toaster />
    </>
  );
}
