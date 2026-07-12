import { useState, useEffect } from "react";
import { OperatePage } from "@/components/pages/OperatePage";
import { FolderPage } from "@/components/pages/FolderPage";
import { ApiDocsPage } from "@/components/pages/ApiDocsPage";
import { ChangelogPage } from "@/components/pages/ChangelogPage";
import { MdRenderer } from "@/components/MdRenderer";
import { Toaster } from "@/components/ui/sonner";
import { Layout, type NavItem } from "@/components/Layout";
import { getStats, type Stats } from "@/api";

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
        return <OperatePage onStatsRefresh={onStatsRefresh} />;
      case "folder":
        return <FolderPage onStatsRefresh={onStatsRefresh} />;
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
      <Toaster />
    </Layout>
  );
}
