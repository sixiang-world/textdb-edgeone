import { useState, useEffect } from "react";
import { OperatePage } from "@/components/pages/OperatePage";
import { FolderPage } from "@/components/pages/FolderPage";
import { ApiDocsPage } from "@/components/pages/ApiDocsPage";
import { ChangelogPage } from "@/components/pages/ChangelogPage";
import { MdRenderer } from "@/components/MdRenderer";
import { QueueStatus } from "@/components/QueueStatus";
import { Toaster } from "@/components/ui/sonner";
import { Layout, type NavItem } from "@/components/Layout";
import { getStats, type Stats } from "@/api";
import { initQueue } from "@/lib/writeQueue";
import { recordKey } from "@/lib/keyHistory";
import { HISTORY_REFRESH_EVENT } from "@/components/KeyHistory";
import { toast } from "sonner";

const NAV_ITEMS = ["operate", "folder", "api", "changelog"] as const;

function getInitialNav(): NavItem {
  try {
    const saved = localStorage.getItem("textdb-active-nav");
    if (NAV_ITEMS.includes(saved as NavItem)) return saved as NavItem;
  } catch { /* localStorage 不可用时静默降级 */ }
  return "operate";
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>(getInitialNav);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStats(controller.signal).then(setStats).catch(() => {});
    return () => controller.abort();
  }, [statsRefreshTrigger]);

  // 记住最后打开的导航项
  useEffect(() => {
    localStorage.setItem("textdb-active-nav", activeNav);
  }, [activeNav]);

  function onStatsRefresh() {
    setStatsRefreshTrigger((n) => n + 1);
  }

  // 初始化写入队列（全局回调：toast + 记录 key + 刷新统计）
  useEffect(() => {
    initQueue({
      onSuccess: (item) => {
        if (item.type === "write") {
          recordKey(item.key, item.value ? new TextEncoder().encode(item.value).length : undefined);
          toast.success("写入成功");
        } else if (item.type === "delete") {
          toast.success("已删除");
        } else if (item.type === "upload") {
          toast.success(`上传成功: ${item.fileName || item.key}`);
        }
        onStatsRefresh();
        // 通知 KeyHistory 刷新
        window.dispatchEvent(new CustomEvent(HISTORY_REFRESH_EVENT));
      },
      onError: (item) => {
        const action = item.type === "write" ? "写入" : item.type === "delete" ? "删除" : "上传";
        toast.error(`${action}失败: ${item.lastError || "未知错误"}（已加入重试队列）`);
      },
    });
  }, []);

  // /md/{key} 路由 — SPA 自行解析
  if (window.location.pathname.startsWith("/md/")) {
    return (
      <>
        <MdRenderer />
        <Toaster />
      </>
    );
  }

  const renderContent = () => {
    switch (activeNav) {
      case "operate":
        return <OperatePage />;
      case "folder":
        return <FolderPage />;
      case "api":
        return <ApiDocsPage />;
      case "changelog":
        return <ChangelogPage />;
    }
  };

  return (
    <Layout
      activeNav={activeNav}
      onNavChange={setActiveNav}
      totalKeys={stats?.totalKeys}
      totalSize={stats?.totalSize}
      writesToday={stats?.writesToday}
    >
      {renderContent()}
      <QueueStatus />
      <Toaster />
    </Layout>
  );
}
