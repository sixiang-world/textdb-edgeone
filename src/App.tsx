import { useState, useEffect } from "react";
import { WriteCard } from "@/components/WriteCard";
import { ApiDocs } from "@/components/ApiDocs";
import { Changelog } from "@/components/Changelog";
import { FolderUpload } from "@/components/FolderUpload";
import { MdRenderer } from "@/components/MdRenderer";
import { Toaster } from "@/components/ui/sonner";
import { Layout, type NavItem } from "@/components/Layout";
import { getStats, type Stats } from "@/api";

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("operate");
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStats(controller.signal).then(setStats).catch(() => {});
    return () => controller.abort();
  }, [statsRefreshTrigger]);

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
        return <WriteCard onStatsRefresh={onStatsRefresh} />;
      case "folder":
        return <FolderUpload onStatsRefresh={onStatsRefresh} />;
      case "api":
        return <ApiDocs />;
      case "changelog":
        return <Changelog />;
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
