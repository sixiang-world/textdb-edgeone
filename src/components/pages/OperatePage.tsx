import { useState } from "react";
import { WriteCard } from "@/components/WriteCard";
import { KeyHistory, HISTORY_REFRESH_EVENT } from "@/components/KeyHistory";

interface OperatePageProps {
  onStatsRefresh?: () => void;
}

export function OperatePage({ onStatsRefresh }: OperatePageProps) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  function handleStatsRefresh() {
    // 通知 KeyHistory 刷新列表
    window.dispatchEvent(new CustomEvent(HISTORY_REFRESH_EVENT));
    onStatsRefresh?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <WriteCard
        onStatsRefresh={handleStatsRefresh}
        selectedKey={selectedKey}
      />
      <KeyHistory onSelect={(key) => setSelectedKey(key)} />
    </div>
  );
}
